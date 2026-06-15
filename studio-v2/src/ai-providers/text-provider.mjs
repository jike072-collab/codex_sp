import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadEnv, projectRoot } from "../config.mjs";
import {
  applyGeneratedPlanningPackage,
  generateDemoPlanningPackage,
  generateProjectDemoScript
} from "../workflow-domain/demo-script.mjs";
import { normalizeConfirmedPlanningPackage } from "../workflow-domain/script-review.mjs";
import {
  isSingleVideoMode,
  selectedVideoDurationSeconds
} from "../workflow-domain/workflow-mode.mjs";
import {
  extractJsonObject,
  hasUsableApiKey,
  positiveInteger,
  postProviderJson,
  ProviderError
} from "./provider-utils.mjs";

const SCRIPT_PROVIDER_LABEL = "脚本模型";

function scriptSchemaInstruction({ singleMode, durationSeconds }) {
  if (singleMode) {
    return [
      "Return exactly one script field named script_video.",
      "Do not return script_20s.",
      `script_video.total_duration_sec must be ${durationSeconds}.`,
      "script_video.segment_full.segment_id must be \"full\".",
      `script_video.segment_full.duration_sec must be ${durationSeconds}.`,
      `segment_full.shots must cover exactly 0 through ${durationSeconds} seconds with no gaps or overlaps.`
    ].join(" ");
  }
  return [
    "Return exactly one script field named script_20s.",
    "Do not return script_video.",
    "script_20s.total_duration_sec must be 20.",
    "script_20s.segment_a_0_10s.segment_id must be \"0-10s\" and duration_sec must be 10.",
    "script_20s.segment_b_10_20s.segment_id must be \"10-20s\" and duration_sec must be 10.",
    "Each segment's shots must cover its full 10-second range with no gaps or overlaps."
  ].join(" ");
}

function scriptOutputSchema({ singleMode, durationSeconds }) {
  const shotShape = {
    start_sec: 0,
    end_sec: 0,
    visual: "",
    action: "",
    camera: "",
    selling_point: "",
    localized_caption_or_vo: "",
    sound: "",
    transition: ""
  };
  const common = {
    locale_profile: {
      target_country: "",
      language: "",
      subtitle_style: "",
      voiceover_style: "",
      cta_style: "",
      copy_notes: []
    },
    product_lock_manifest: {
      shoe_type: "",
      main_colors: [],
      supporting_colors: [],
      upper_material_visible: "",
      midsole_shape: "",
      outsole_color: "",
      outsole_pattern: "",
      side_pattern_or_logo: "",
      heel_structure: "",
      must_keep: [],
      must_not_change: []
    },
    selling_points: [{
      point: "",
      evidence: "visible | inferred | user_provided",
      visual_proof: "",
      ad_expression: ""
    }],
    creative_direction: {
      video_positioning: "",
      core_emotion: [],
      visual_style: [],
      recommended_theme: "",
      theme_reason: ""
    },
    hooks: [{
      hook: "",
      time_hint: "1-3s",
      selling_point: "",
      emotion: ""
    }],
    localized_copy: {
      caption_lines: [],
      cta_options: [],
      do_not_use: []
    },
    confirmation_summary: {
      what_to_confirm: [],
      risk_notes: []
    }
  };
  if (singleMode) {
    return {
      ...common,
      script_video: {
        total_duration_sec: durationSeconds,
        segment_full: {
          segment_id: "full",
          theme: "",
          duration_sec: durationSeconds,
          shots: [shotShape]
        }
      }
    };
  }
  return {
    ...common,
    script_20s: {
      total_duration_sec: 20,
      segment_a_0_10s: {
        segment_id: "0-10s",
        theme: "",
        duration_sec: 10,
        shots: [shotShape]
      },
      segment_b_10_20s: {
        segment_id: "10-20s",
        theme: "",
        duration_sec: 10,
        shots: [shotShape]
      }
    }
  };
}

export async function generateProjectScript(
  project,
  generatedAt = new Date().toISOString(),
  { fetchImpl = fetch, shotsPerSegment = 5 } = {}
) {
  const options = { shotsPerSegment };
  const env = await loadEnv();
  const apiKey = env.TEXT_MODEL_API_KEY;
  if (!hasUsableApiKey(apiKey)) {
    return generateProjectDemoScript(project, generatedAt, options);
  }

  // This also enforces the same review and market prerequisites as demo mode.
  generateDemoPlanningPackage(project, options);

  const apiUrl = env.TEXT_API_URL || "https://api.deepseek.com/chat/completions";
  const model = env.TEXT_MODEL || "deepseek-v4-pro";
  const singleMode = isSingleVideoMode(project);
  const durationSeconds = selectedVideoDurationSeconds(project);
  const systemPrompt = await readFile(
    join(projectRoot, "prompts", "01_planning_and_script.system.md"),
    "utf8"
  );
  const modeInstruction = scriptSchemaInstruction({ singleMode, durationSeconds });
  const outputSchema = scriptOutputSchema({ singleMode, durationSeconds });
  const payload = await postProviderJson({
    url: apiUrl,
    apiKey,
    timeoutMs: positiveInteger(env.TEXT_TIMEOUT_MS, 180000),
    providerLabel: SCRIPT_PROVIDER_LABEL,
    errorCode: "TEXT_PROVIDER_ERROR",
    fetchImpl,
    body: {
      model,
      messages: [
        {
          role: "system",
          content: [
            systemPrompt,
            "",
            "# Mode-Specific Output Contract",
            modeInstruction,
            "Return only one JSON object matching the current mode. Do not include alternate-mode script fields."
          ].join("\n")
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate the complete planning package JSON for this reviewed shoe project.",
            workflow_mode: singleMode ? "single_video" : "legacy_multi_segment",
            total_duration_seconds: durationSeconds,
            required_script_shape: modeInstruction,
            required_top_level_keys: singleMode
              ? ["locale_profile", "product_lock_manifest", "selling_points", "creative_direction", "hooks", "script_video", "localized_copy", "confirmation_summary"]
              : ["locale_profile", "product_lock_manifest", "selling_points", "creative_direction", "hooks", "script_20s", "localized_copy", "confirmation_summary"],
            forbidden_top_level_keys: singleMode ? ["script_20s"] : ["script_video"],
            output_schema: outputSchema,
            shots_per_10s_segment: options.shotsPerSegment || 5,
            shot_diversity_requirements: [
              "Every shot must advance a distinct narrative stage: hook, product identity, visible proof, movement or use context, and closing CTA.",
              "Do not reuse the same visual, action, and camera sentence while only changing timestamps.",
              "Do not repeat the same template across a majority of shots for any two of visual, action, and camera.",
              "Keep product identity rules consistent without copying the same full shot row."
            ],
            vision_analysis: project.visionAnalysis,
            market_brief: project.marketBrief
          })
        }
      ],
      response_format: { type: "json_object" },
      thinking: { type: "enabled" },
      reasoning_effort: "high",
      stream: false
    }
  });

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new ProviderError("脚本模型响应中没有可用内容。", {
      code: "TEXT_PROVIDER_ERROR"
    });
  }
  const generated = extractJsonObject(content, SCRIPT_PROVIDER_LABEL);
  let planningPackage;
  try {
    planningPackage = normalizeConfirmedPlanningPackage(
      { ...generated, mode: "api" },
      project.visionAnalysis.product_lock_manifest,
      {
        workflowMode: project.workflowMode,
        videoDurationSeconds: project.marketBrief?.videoDurationSeconds
      }
    );
  } catch (error) {
    throw new ProviderError(`脚本模型返回的内容未通过校验：${error.message}`, {
      code: "TEXT_PROVIDER_INVALID_OUTPUT",
      cause: error
    });
  }
  return applyGeneratedPlanningPackage(project, planningPackage, generatedAt);
}

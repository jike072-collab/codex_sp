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
  const payload = await postProviderJson({
    url: apiUrl,
    apiKey,
    timeoutMs: positiveInteger(env.TEXT_TIMEOUT_MS, 180000),
    providerLabel: "DeepSeek 脚本模型",
    errorCode: "TEXT_PROVIDER_ERROR",
    fetchImpl,
    body: {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            task: "Generate the complete planning package JSON for this reviewed shoe project.",
            workflow_mode: singleMode ? "single_video" : "legacy_multi_segment",
            total_duration_seconds: durationSeconds,
            required_script_shape: singleMode
              ? "Return script_video.segment_full covering exactly 0 through total_duration_seconds. Do not return script_20s."
              : "Return script_20s with segment_a_0_10s and segment_b_10_20s. Do not return script_video.",
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
    throw new ProviderError("DeepSeek 脚本模型响应中没有可用内容。", {
      code: "TEXT_PROVIDER_ERROR"
    });
  }
  const generated = extractJsonObject(content, "DeepSeek 脚本模型");
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
    throw new ProviderError(`DeepSeek 返回的脚本未通过校验：${error.message}`, {
      code: "TEXT_PROVIDER_INVALID_OUTPUT",
      cause: error
    });
  }
  return applyGeneratedPlanningPackage(project, planningPackage, generatedAt);
}

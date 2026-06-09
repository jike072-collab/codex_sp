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
            shots_per_10s_segment: options.shotsPerSegment || 5,
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
      project.visionAnalysis.product_lock_manifest
    );
  } catch (error) {
    throw new ProviderError(`DeepSeek 返回的脚本未通过校验：${error.message}`, {
      code: "TEXT_PROVIDER_INVALID_OUTPUT",
      cause: error
    });
  }
  return applyGeneratedPlanningPackage(project, planningPackage, generatedAt);
}

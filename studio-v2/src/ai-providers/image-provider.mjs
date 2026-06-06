import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadEnv, uploadsRoot } from "../config.mjs";
import { generateVisualPackage } from "../workflow-domain/visual-package.mjs";
import {
  hasUsableApiKey,
  positiveInteger,
  postProviderJson,
  ProviderError
} from "./provider-utils.mjs";

async function referenceImages(project) {
  return Promise.all((project.assets || []).map(async (asset) => {
    const bytes = await readFile(join(uploadsRoot, project.id, asset.storedName));
    return `data:${asset.mimeType};base64,${bytes.toString("base64")}`;
  }));
}

function sizeFor(item, env) {
  return item.aspect_ratio === "16:9"
    ? env.STORYBOARD_IMAGE_SIZE || "1536x1024"
    : env.KEYFRAME_IMAGE_SIZE || "1024x1536";
}

export async function generateProjectVisuals(
  project,
  generatedAt = new Date().toISOString(),
  { fetchImpl = fetch } = {}
) {
  generateVisualPackage(project, generatedAt);

  const env = await loadEnv();
  const apiKey = env.IMAGE_MODEL_API_KEY;
  const provider = String(env.IMAGE_MODEL_PROVIDER || "right_codes").trim().toLowerCase();
  if (provider === "manual" || !hasUsableApiKey(apiKey)) return project;

  const apiUrl = env.IMAGE_API_URL
    || "https://www.right.codes/draw/v1/images/generations";
  const model = env.IMAGE_MODEL || "gpt-image-2";
  const images = await referenceImages(project);

  for (const item of project.imagePackage.image_generation) {
    const payload = await postProviderJson({
      url: apiUrl,
      apiKey,
      timeoutMs: positiveInteger(env.IMAGE_TIMEOUT_MS, 300000),
      providerLabel: "Right Code 图片模型",
      errorCode: "IMAGE_PROVIDER_ERROR",
      fetchImpl,
      body: {
        model,
        prompt: `${item.prompt}\nAvoid: ${item.negative_prompt}`,
        image: images,
        size: sizeFor(item, env),
        response_format: "url"
      }
    });
    const url = payload?.data?.[0]?.url;
    if (!url) {
      throw new ProviderError("Right Code 图片模型响应中没有图片 URL。", {
        code: "IMAGE_PROVIDER_ERROR"
      });
    }
    item.generated_image = {
      provider: "right_codes",
      model,
      url,
      size: sizeFor(item, env)
    };
  }

  project.imagePackage.mode = "api";
  return project;
}

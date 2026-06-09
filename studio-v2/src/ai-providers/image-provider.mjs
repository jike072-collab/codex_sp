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

async function referenceImages(
  project,
  { readFileImpl = readFile, uploadsRootPath = uploadsRoot } = {}
) {
  return Promise.all((project.assets || []).map(async (asset) => {
    const bytes = await readFileImpl(join(uploadsRootPath, project.id, asset.storedName));
    return bytes.toString("base64");
  }));
}

function sizeFor(item, env) {
  const configured = env[`IMAGE_SIZE_${String(item.aspect_ratio || "").replace(":", "_")}`];
  if (configured) return configured;
  const sizes = {
    "9:16": "1024x1536",
    "16:9": "1536x1024",
    "1:1": "1024x1024",
    "4:5": "1024x1280",
    "3:4": "1024x1365",
    "2:3": "1024x1536"
  };
  return sizes[item.aspect_ratio] || env.STORYBOARD_IMAGE_SIZE || "1024x1536";
}

async function requestGeneratedImage({
  apiUrl,
  apiKey,
  timeoutMs,
  fetchImpl,
  model,
  item,
  images,
  env
}) {
  return postProviderJson({
    url: apiUrl,
    apiKey,
    timeoutMs,
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
}

export async function generateProjectVisuals(
  project,
  generatedAt = new Date().toISOString(),
  {
    fetchImpl = fetch,
    readFileImpl = readFile,
    uploadsRootPath = uploadsRoot
  } = {}
) {
  generateVisualPackage(project, generatedAt);

  const env = await loadEnv();
  const apiKey = env.IMAGE_MODEL_API_KEY;
  const provider = String(env.IMAGE_MODEL_PROVIDER || "right_codes").trim().toLowerCase();
  if (provider === "manual" || !hasUsableApiKey(apiKey)) return project;

  const apiUrl = env.IMAGE_API_URL
    || "https://www.right.codes/draw/v1/images/generations";
  const model = env.IMAGE_MODEL || "gpt-image-2";
  const images = await referenceImages(project, { readFileImpl, uploadsRootPath });
  let useReferenceImages = Boolean(images.length);

  for (const item of project.imagePackage.image_generation) {
    const timeoutMs = positiveInteger(env.IMAGE_TIMEOUT_MS, 300000);
    let referenceMode = useReferenceImages ? "reference_images" : "prompt_only";
    let payload;
    try {
      payload = await requestGeneratedImage({
        apiUrl,
        apiKey,
        timeoutMs,
        fetchImpl,
        model,
        item,
        images: useReferenceImages ? images : [],
        env
      });
    } catch (error) {
      if (!(error instanceof ProviderError) || error.providerStatus !== 403 || !useReferenceImages) {
        throw error;
      }
      useReferenceImages = false;
      referenceMode = "prompt_only_after_reference_403";
      payload = await requestGeneratedImage({
        apiUrl,
        apiKey,
        timeoutMs,
        fetchImpl,
        model,
        item,
        images: [],
        env
      });
    }

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
      size: sizeFor(item, env),
      referenceMode
    };
  }

  project.imagePackage.mode = "api";
  return project;
}

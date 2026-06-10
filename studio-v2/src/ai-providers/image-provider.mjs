import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadEnv, uploadsRoot } from "../config.mjs";
import { storeGeneratedProjectImage } from "../storage/project-repository.mjs";
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

function detectedImageType(bytes, declaredType = "") {
  const normalized = String(declaredType).split(";")[0].trim().toLowerCase();
  if (["image/png", "image/jpeg", "image/webp"].includes(normalized)) return normalized;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return "";
}

function imageResult(payload) {
  const first = payload?.data?.[0] || payload?.images?.[0] || payload?.result || payload || {};
  const base64 = first.b64_json || first.base64 || first.image_base64
    || payload?.b64_json || payload?.base64 || payload?.image_base64;
  const url = first.url || first.image_url || first.output_url
    || payload?.url || payload?.image_url || payload?.output_url;
  if (base64) return { base64: String(base64) };
  if (url) return { url: String(url) };
  if (typeof first.image === "string") {
    return first.image.startsWith("http") || first.image.startsWith("data:")
      ? { url: first.image }
      : { base64: first.image };
  }
  return null;
}

async function storeImageResult(
  projectId,
  result,
  {
    downloadFetchImpl,
    storeGeneratedImageImpl,
    timeoutMs
  }
) {
  let bytes;
  let declaredType = "";
  if (result.base64) {
    bytes = Buffer.from(result.base64.replace(/^data:image\/[^;]+;base64,/i, ""), "base64");
    declaredType = result.base64.match(/^data:(image\/[^;]+);base64,/i)?.[1] || "";
  } else if (result.url?.startsWith("data:")) {
    const match = result.url.match(/^data:(image\/[^;]+);base64,(.+)$/is);
    if (!match) throw new Error("生成图片 data URL 格式无效。");
    declaredType = match[1];
    bytes = Buffer.from(match[2], "base64");
  } else {
    const response = await downloadFetchImpl(result.url, {
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`生成图片下载失败（HTTP ${response.status}）。`);
    declaredType = response.headers.get("content-type") || "";
    bytes = Buffer.from(await response.arrayBuffer());
  }

  const mimeType = detectedImageType(bytes, declaredType);
  if (!mimeType) throw new Error("供应商返回的内容不是支持的 PNG、JPEG 或 WebP 图片。");
  return storeGeneratedImageImpl(projectId, bytes, mimeType);
}

function previousGeneratedImages(project) {
  return new Map((project.imagePackage?.image_generation || [])
    .filter((item) => item.generated_image?.url)
    .map((item) => [`${item.asset_id}|${item.aspect_ratio}`, item.generated_image]));
}

async function generateStoryboardItem({
  project,
  item,
  previous,
  images,
  apiUrl,
  apiKey,
  model,
  env,
  fetchImpl,
  downloadFetchImpl,
  storeGeneratedImageImpl
}) {
  const timeoutMs = positiveInteger(env.IMAGE_TIMEOUT_MS, 300000);
  if (previous?.url?.startsWith(`/uploads/${project.id}/`)) {
    item.generated_image = previous;
    return;
  }
  if (previous?.url) {
    try {
      const stored = await storeImageResult(project.id, { url: previous.url }, {
        downloadFetchImpl,
        storeGeneratedImageImpl,
        timeoutMs
      });
      item.generated_image = { ...previous, ...stored, sourceUrl: previous.url };
      return;
    } catch {
      // Expired provider URLs are regenerated below.
    }
  }

  if (!images.length) {
    throw new ProviderError("img2 生图必须包含商品参考图，请先上传鞋图。", {
      code: "IMAGE_REFERENCE_REQUIRED"
    });
  }
  const payload = await requestGeneratedImage({
    apiUrl,
    apiKey,
    timeoutMs,
    fetchImpl,
    model,
    item,
    images,
    env
  });

  const result = imageResult(payload);
  if (!result) {
    throw new ProviderError("Right Code 图片模型响应中没有可识别的图片数据。", {
      code: "IMAGE_PROVIDER_ERROR"
    });
  }
  let stored;
  try {
    stored = await storeImageResult(project.id, result, {
      downloadFetchImpl,
      storeGeneratedImageImpl,
      timeoutMs
    });
  } catch (error) {
    throw new ProviderError(`Right Code 图片已生成，但保存到本地失败：${error.message}`, {
      code: "IMAGE_PROVIDER_DOWNLOAD_ERROR",
      possiblyBilled: true,
      cause: error
    });
  }
  item.generated_image = {
    provider: "right_codes",
    model,
    ...stored,
    ...(result.url && !result.url.startsWith("data:") ? { sourceUrl: result.url } : {}),
    size: sizeFor(item, env),
    referenceMode: "reference_images"
  };
}

export async function generateProjectVisuals(
  project,
  generatedAt = new Date().toISOString(),
  {
    fetchImpl = fetch,
    downloadFetchImpl = fetch,
    readFileImpl = readFile,
    uploadsRootPath = uploadsRoot,
    storeGeneratedImageImpl = storeGeneratedProjectImage
  } = {}
) {
  const previousImages = previousGeneratedImages(project);
  generateVisualPackage(project, generatedAt);

  const env = await loadEnv();
  const apiKey = env.IMAGE_MODEL_API_KEY;
  const provider = String(env.IMAGE_MODEL_PROVIDER || "right_codes").trim().toLowerCase();
  if (provider === "manual" || !hasUsableApiKey(apiKey)) return project;

  const apiUrl = env.IMAGE_API_URL
    || "https://www.right.codes/draw/v1/images/generations";
  const model = env.IMAGE_MODEL || "gpt-image-2";
  const images = await referenceImages(project, { readFileImpl, uploadsRootPath });
  const results = await Promise.allSettled(
    project.imagePackage.image_generation.map((item) => generateStoryboardItem({
      project,
      item,
      previous: previousImages.get(`${item.asset_id}|${item.aspect_ratio}`),
      images,
      apiUrl,
      apiKey,
      model,
      env,
      fetchImpl,
      downloadFetchImpl,
      storeGeneratedImageImpl
    }))
  );
  const failures = results.filter((result) => result.status === "rejected");
  project.imagePackage.mode = failures.length ? "partial" : "api";
  if (failures.length) throw failures[0].reason;
  return project;
}

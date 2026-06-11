import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadEnv, uploadsRoot } from "../config.mjs";
import { storeGeneratedProjectImage } from "../storage/project-repository.mjs";
import { readImageDrawChannels } from "../storage/provider-settings.mjs";
import {
  completeVisualGeneration,
  generateVisualPackage
} from "../workflow-domain/visual-package.mjs";
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
    return {
      base64: bytes.toString("base64"),
      byteLength: bytes.length
    };
  }));
}

function sizeFor(item, env) {
  return env.STORYBOARD_SHEET_SIZE
    || item.storyboard_sheet?.default_size
    || env.STORYBOARD_IMAGE_SIZE
    || "1536x1024";
}

function channelForItem(item, channels) {
  return channels.find((channel) => channel.segmentId === item.segment_id)
    || channels[0]
    || null;
}

function safeEndpointMeta(apiUrl) {
  try {
    const parsed = new URL(apiUrl);
    return {
      providerHost: parsed.host,
      providerPath: parsed.pathname
    };
  } catch {
    return {
      providerHost: "",
      providerPath: ""
    };
  }
}

async function requestGeneratedImage({
  channel,
  timeoutMs,
  fetchImpl,
  item,
  images,
  env
}) {
  const prompt = `${item.prompt}\nAvoid: ${item.negative_prompt}`;
  return postProviderJson({
    url: channel.apiUrl,
    apiKey: channel.apiKey,
    timeoutMs,
    providerLabel: `Right Code 图片模型（${channel.title}）`,
    errorCode: "IMAGE_PROVIDER_ERROR",
    includeProviderDetail: false,
    fetchImpl,
    body: {
      model: channel.model,
      prompt,
      image: images.map((image) => image.base64),
      size: sizeFor(item, env),
      response_format: "url"
    }
  });
}

function referenceTotalBytes(images) {
  return images.reduce((total, image) => total + image.byteLength, 0);
}

function storyboardDiagnostic({ project, item, channel, images, env, startedAt, attemptId }) {
  const prompt = `${item.prompt}\nAvoid: ${item.negative_prompt}`;
  const endpoint = safeEndpointMeta(channel.apiUrl);
  return {
    projectId: project.id,
    segmentId: item.segment_id,
    assetId: item.asset_id,
    attemptId,
    startedAt,
    model: channel.model,
    requestedSize: sizeFor(item, env),
    referenceImageCount: images.length,
    referenceImageTotalBytes: referenceTotalBytes(images),
    promptCharCount: prompt.length,
    drawChannelId: channel.id,
    drawChannelTitle: channel.title,
    keyPreview: channel.keyPreview,
    providerHost: endpoint.providerHost,
    providerPath: endpoint.providerPath,
    responseFormat: "url"
  };
}

function finishDiagnostic(diagnostic, startedMs, outcome, error) {
  const finished = {
    ...diagnostic,
    elapsedMs: Date.now() - startedMs,
    outcome
  };
  if (Number.isInteger(error?.providerStatus)) {
    finished.providerStatus = error.providerStatus;
  } else if (outcome === "success") {
    finished.providerStatus = 200;
  }
  if (error?.providerRequestId) finished.providerRequestId = error.providerRequestId;
  if (error?.code) finished.errorCode = error.code;
  return finished;
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

function reusesStoredLocalImage(projectId, previous) {
  return previous?.url?.startsWith(`/uploads/${projectId}/`);
}

async function generateStoryboardItem({
  project,
  item,
  previous,
  images,
  channel,
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

  if (!channel) {
    throw new ProviderError(`未找到 ${item.segment_id} 故事板对应的绘图通道。`, {
      code: "IMAGE_PROVIDER_NOT_CONFIGURED"
    });
  }
  if (!hasUsableApiKey(channel.apiKey)) {
    throw new ProviderError(`${channel.title} 未配置可用的图片 API Key。`, {
      code: "IMAGE_PROVIDER_NOT_CONFIGURED"
    });
  }
  if (!images.length) {
    throw new ProviderError("img2 生图必须包含商品参考图，请先上传鞋图。", {
      code: "IMAGE_REFERENCE_REQUIRED"
    });
  }

  const attemptId = randomUUID();
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const diagnostic = storyboardDiagnostic({
    project,
    item,
    channel,
    images,
    env,
    startedAt,
    attemptId
  });
  item.provider_diagnostics = diagnostic;

  try {
    const payload = await requestGeneratedImage({
      channel,
      timeoutMs,
      fetchImpl,
      item,
      images,
      env
    });

    const result = imageResult(payload);
    if (!result) {
      throw new ProviderError("Right Code 图片模型返回了不可识别的图片结果。", {
        code: "IMAGE_PROVIDER_INVALID_OUTPUT",
        providerStatus: 200,
        possiblyBilled: true
      });
    }

    const stored = await storeImageResult(project.id, result, {
      downloadFetchImpl,
      storeGeneratedImageImpl,
      timeoutMs
    });
    item.generated_image = {
      provider: "right_codes",
      model: channel.model,
      ...stored,
      ...(result.url && !result.url.startsWith("data:") ? { sourceUrl: result.url } : {}),
      size: sizeFor(item, env),
      referenceMode: "reference_images"
    };
    item.provider_diagnostics = finishDiagnostic(diagnostic, startedMs, "success");
  } catch (error) {
    const providerError = error instanceof ProviderError
      ? error
      : new ProviderError(`Right Code 图片已生成，但保存到本地失败：${error.message}`, {
        code: "IMAGE_PROVIDER_DOWNLOAD_ERROR",
        providerStatus: 200,
        possiblyBilled: true,
        cause: error
      });
    item.provider_diagnostics = finishDiagnostic(diagnostic, startedMs, "failed", providerError);
    throw providerError;
  }
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
  const provider = String(env.IMAGE_MODEL_PROVIDER || "right_codes").trim().toLowerCase();
  if (provider === "manual") {
    throw new ProviderError("故事板必须使用已配置的双绘图通道生成，请先配置图片模型。", {
      code: "IMAGE_PROVIDER_NOT_CONFIGURED"
    });
  }

  const channels = readImageDrawChannels(env);
  const images = await referenceImages(project, { readFileImpl, uploadsRootPath });
  const plannedItems = project.imagePackage.image_generation.map((item) => ({
    item,
    previous: previousImages.get(`${item.asset_id}|${item.aspect_ratio}`),
    channel: channelForItem(item, channels)
  }));
  const missingChannel = plannedItems.find(({ item, previous, channel }) => (
    !reusesStoredLocalImage(project.id, previous)
    && (!channel || !hasUsableApiKey(channel.apiKey))
    && (project.assets || []).length
  ));
  if (missingChannel) {
    const channelLabel = missingChannel.channel?.title || `${missingChannel.item.segment_id} 对应通道`;
    throw new ProviderError(`${channelLabel} 未配置可用的图片 API Key。`, {
      code: "IMAGE_PROVIDER_NOT_CONFIGURED"
    });
  }
  const results = await Promise.allSettled(
    plannedItems.map(async ({ item, previous, channel }) => {
      item.status = "running";
      delete item.error;
      try {
        await generateStoryboardItem({
          project,
          item,
          previous,
          images,
          channel,
          env,
          fetchImpl,
          downloadFetchImpl,
          storeGeneratedImageImpl
        });
        item.status = "done";
      } catch (error) {
        item.status = "failed";
        item.error = {
          code: error?.code || "IMAGE_PROVIDER_ERROR",
          message: error?.message || "故事板生成失败。",
          retryable: Boolean(error?.retryable)
        };
        throw error;
      }
    })
  );
  const failures = results.filter((result) => result.status === "rejected");
  project.imagePackage.mode = failures.length ? "partial" : "api";
  if (failures.length) throw failures[0].reason;
  return completeVisualGeneration(project, generatedAt);
}

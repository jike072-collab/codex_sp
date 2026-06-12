import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadEnv, uploadsRoot } from "../config.mjs";
import { storeGeneratedProjectVideo } from "../storage/project-repository.mjs";
import {
  ensureVideoPackage,
  videoItemForSegment,
  markVideoItemFailed,
  resetVideoItemForRetry,
  syncVideoPackageMode,
  allSegmentVideosDone
} from "../workflow-domain/video-package.mjs";
import { isSingleVideoMode } from "../workflow-domain/workflow-mode.mjs";
import {
  hasUsableApiKey,
  maskedApiKeyPreview,
  positiveInteger,
  ProviderError
} from "./provider-utils.mjs";

const DEFAULT_VIDEO_API_URL = "https://clmm-mall.top/v1/videos/generations";
const DEFAULT_VIDEO_MODEL = "seedance2.0 720p-fast";
const VIDEO_STATES = new Set([
  "waiting",
  "submitting",
  "queued",
  "generating",
  "downloading",
  "done",
  "failed"
]);

function scriptBySegmentId(project) {
  if (isSingleVideoMode(project)) {
    return { full: project.planningPackage?.script_video?.segment_full };
  }
  return {
    "0-10s": project.planningPackage?.script_20s?.segment_a_0_10s,
    "10-20s": project.planningPackage?.script_20s?.segment_b_10_20s
  };
}

function safeEndpointMeta(apiUrl) {
  try {
    const parsed = new URL(apiUrl);
    return { providerHost: parsed.host, providerPath: parsed.pathname };
  } catch {
    return { providerHost: "", providerPath: "" };
  }
}

async function readReferenceImageDataUrls(
  project,
  { readFileImpl = readFile, uploadsRootPath = uploadsRoot } = {}
) {
  return Promise.all((project.assets || []).map(async (asset) => {
    const bytes = await readFileImpl(join(uploadsRootPath, project.id, asset.storedName));
    return {
      mimeType: asset.mimeType,
      dataUrl: `data:${asset.mimeType};base64,${bytes.toString("base64")}`,
      byteLength: bytes.length
    };
  }));
}

async function readStoryboardImageDataUrl(
  project,
  item,
  { readFileImpl = readFile, uploadsRootPath = uploadsRoot } = {}
) {
  const storyboard = (project.imagePackage?.image_generation || [])
    .find((entry) => entry.segment_id === item.segment_id);
  if (!storyboard?.generated_image?.storedName) {
    throw new ProviderError("当前分段故事板还没有本地文件，无法生成视频。", {
      code: "VIDEO_STORYBOARD_NOT_READY"
    });
  }
  const mimeType = storyboard.generated_image.mimeType || "image/png";
  const bytes = await readFileImpl(join(uploadsRootPath, project.id, storyboard.generated_image.storedName));
  return {
    mimeType,
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
    byteLength: bytes.length
  };
}

function normalizeVideoStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "submitting") return "submitting";
  if (["queued", "submitted", "pending", "waiting"].includes(normalized)) return "queued";
  if (["generating", "processing", "running", "in_progress"].includes(normalized)) return "generating";
  if (normalized === "downloading") return "downloading";
  if (["done", "completed", "succeeded", "success"].includes(normalized)) return "done";
  if (["failed", "error", "cancelled", "canceled", "expired"].includes(normalized)) return "failed";
  return "";
}

function resultFromPayload(payload) {
  const first = payload?.data?.[0] || payload?.video || payload?.result || payload || {};
  const sourceUrl = first.url || first.video_url || first.output_url || first.download_url
    || payload?.url || payload?.video_url || payload?.output_url || payload?.download_url;
  return {
    jobId: first.id || first.video_id || payload?.id || payload?.video_id || "",
    providerStatus: normalizeVideoStatus(first.status || payload?.status),
    statusUrl: first.status_url || payload?.status_url || "",
    sourceUrl: sourceUrl ? String(sourceUrl) : "",
    mimeType: first.mime_type || payload?.mime_type || "",
    sizeBytes: first.bytes || payload?.bytes || first.size || payload?.size || 0
  };
}

function deriveStatusUrl(apiUrl, jobId) {
  if (!jobId) return "";
  try {
    const parsed = new URL(apiUrl);
    if (/\/videos\/generations\/?$/i.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(/\/videos\/generations\/?$/i, `/videos/${encodeURIComponent(jobId)}`);
      parsed.search = "";
      return parsed.toString();
    }
  } catch {
    return "";
  }
  return "";
}

function videoPrompt(project, item, segment) {
  const lines = segment.shots.map((shot, index) => (
    `${index + 1}. ${shot.start_sec}-${shot.end_sec}s | 画面:${shot.visual} | 动作:${shot.action} | 镜头:${shot.camera} | 卖点:${shot.selling_point} | 口播/字幕:${shot.localized_caption_or_vo} | 音效:${shot.sound} | 转场:${shot.transition}`
  )).join("\n");
  return [
    `Create one ${item.aspect_ratio} ecommerce shoe video segment for ONLY ${item.segment_id}.`,
    "Use the attached storyboard sheet as the primary visual plan.",
    "Use the uploaded shoe product photos as identity references for the exact same shoe.",
    `Target aspect ratio: ${item.aspect_ratio}. Duration: ${item.duration_sec} seconds. Resolution: 720p.`,
    "Do not include scenes from the other segment. Keep the shoe silhouette, colors, outsole, midsole, and logo placement accurate.",
    `Storyboard script copy:\n${item.script_copy}`,
    `Detailed shot plan:\n${lines}`
  ].join("\n");
}

function buildVideoRequest(project, item, segment, storyboardImage, referenceImages, model) {
  return {
    model: model || DEFAULT_VIDEO_MODEL,
    prompt: videoPrompt(project, item, segment),
    image: [storyboardImage.dataUrl, ...referenceImages.map((image) => image.dataUrl)],
    duration: item.duration_sec,
    resolution: "720p",
    aspect_ratio: item.aspect_ratio,
    response_format: "url"
  };
}

function createDiagnostics(item, env, storyboardImage, referenceImages, startedAt, attemptId) {
  const endpoint = safeEndpointMeta(env.VIDEO_API_URL || DEFAULT_VIDEO_API_URL);
  return {
    segmentId: item.segment_id,
    assetId: item.asset_id,
    attemptId,
    startedAt,
    model: env.VIDEO_MODEL || DEFAULT_VIDEO_MODEL,
    aspectRatio: item.aspect_ratio,
    durationSec: item.duration_sec,
    providerHost: endpoint.providerHost,
    providerPath: endpoint.providerPath,
    storyboardImageCount: 1,
    referenceImageCount: referenceImages.length,
    inputImageCount: 1 + referenceImages.length,
    referenceImageTotalBytes: referenceImages.reduce((total, image) => total + image.byteLength, 0),
    storyboardImageBytes: storyboardImage.byteLength,
    keyPreview: maskedApiKeyPreview(env.VIDEO_MODEL_API_KEY)
  };
}

function finishDiagnostics(diagnostics, startedMs, outcome, extra = {}) {
  return {
    ...diagnostics,
    elapsedMs: Date.now() - startedMs,
    outcome,
    ...extra
  };
}

function authHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}

function responseRequestId(response) {
  return response.headers.get("x-request-id")
    || response.headers.get("cf-ray")
    || response.headers.get("x-correlation-id")
    || "";
}

async function postVideoGeneration(apiUrl, apiKey, body, timeoutMs, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(apiKey)
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new ProviderError(
      timedOut ? "视频生成请求超时。" : "视频生成请求失败。",
      {
        code: timedOut ? "VIDEO_PROVIDER_TIMEOUT" : "VIDEO_PROVIDER_ERROR",
        retryable: timedOut,
        possiblyBilled: timedOut,
        cause: error
      }
    );
  }

  if (!response.ok) {
    throw new ProviderError(`视频生成失败（HTTP ${response.status}）。`, {
      code: [408, 504, 524].includes(response.status) ? "VIDEO_PROVIDER_TIMEOUT" : "VIDEO_PROVIDER_ERROR",
      providerStatus: response.status,
      providerRequestId: responseRequestId(response) || undefined,
      retryable: [408, 504, 524].includes(response.status),
      possiblyBilled: [408, 504, 524].includes(response.status)
    });
  }

  return {
    payload: await response.json(),
    providerRequestId: responseRequestId(response)
  };
}

async function fetchVideoStatus(statusUrl, apiKey, timeoutMs, fetchImpl) {
  const response = await fetchImpl(statusUrl, {
    method: "GET",
    headers: authHeaders(apiKey),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    throw new ProviderError(`视频状态查询失败（HTTP ${response.status}）。`, {
      code: "VIDEO_PROVIDER_STATUS_ERROR",
      providerStatus: response.status,
      providerRequestId: responseRequestId(response) || undefined,
      retryable: [408, 504, 524].includes(response.status),
      possiblyBilled: false
    });
  }
  return {
    payload: await response.json(),
    providerRequestId: responseRequestId(response)
  };
}

function detectVideoMimeType(declaredType = "", sourceUrl = "") {
  const normalized = String(declaredType).split(";")[0].trim().toLowerCase();
  if (["video/mp4", "video/webm", "video/quicktime"].includes(normalized)) return normalized;
  if (/\.webm(?:\?|$)/i.test(sourceUrl)) return "video/webm";
  if (/\.mov(?:\?|$)/i.test(sourceUrl)) return "video/quicktime";
  return "video/mp4";
}

export function videoFileExtension(mimeType = "") {
  const normalized = String(mimeType).split(";")[0].trim().toLowerCase();
  if (normalized === "video/webm") return ".webm";
  if (normalized === "video/quicktime") return ".mov";
  return ".mp4";
}

async function storeVideoResult(projectId, result, { downloadFetchImpl, storeGeneratedVideoImpl, timeoutMs, prefix }) {
  let bytes;
  let mimeType = result.mimeType || "";
  if (result.sourceUrl.startsWith("data:")) {
    const match = result.sourceUrl.match(/^data:(video\/[^;]+);base64,(.+)$/is);
    if (!match) throw new Error("视频 data URL 格式无效。");
    mimeType = match[1];
    bytes = Buffer.from(match[2], "base64");
  } else {
    const response = await downloadFetchImpl(result.sourceUrl, {
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`视频下载失败（HTTP ${response.status}）。`);
    mimeType = response.headers.get("content-type") || mimeType;
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const detectedMimeType = detectVideoMimeType(mimeType, result.sourceUrl);
  return storeGeneratedVideoImpl(projectId, bytes, detectedMimeType, prefix);
}

function ffmpegAvailable(execFileImpl = execFile) {
  return new Promise((resolve) => {
    execFileImpl("ffmpeg", ["-version"], { windowsHide: true }, (error) => {
      resolve(!error);
    });
  });
}

function mergeVideoFiles(inputPaths, outputPath, execFileImpl = execFile) {
  return new Promise(async (resolve, reject) => {
    const listPath = join(tmpdir(), `shoe-ad-ffmpeg-${randomUUID()}.txt`);
    const listBody = inputPaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join("\n");
    await writeFile(listPath, listBody, "utf8");
    execFileImpl(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath],
      { windowsHide: true },
      async (error) => {
        await unlink(listPath).catch(() => {});
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function maybeMergeFinalVideo(
  project,
  {
    ffmpegAvailableImpl = ffmpegAvailable,
    mergeVideoFilesImpl = mergeVideoFiles,
    readFileImpl = readFile,
    uploadsRootPath = uploadsRoot,
    storeGeneratedVideoImpl = storeGeneratedProjectVideo
  } = {}
) {
  if (isSingleVideoMode(project)) return project;
  if (!allSegmentVideosDone(project)) {
    syncVideoPackageMode(project);
    return project;
  }
  if (project.videoPackage.final_video?.status === "done") return project;

  const available = await ffmpegAvailableImpl();
  if (!available) {
    project.videoPackage.final_video = {
      status: "unavailable",
      reason: "ffmpeg_not_available"
    };
    syncVideoPackageMode(project);
    return project;
  }

  const inputs = project.videoPackage.video_generation.map((item) => join(uploadsRootPath, project.id, item.generated_video.storedName));
  const outputPath = join(tmpdir(), `shoe-ad-video-final-${randomUUID()}.mp4`);
  project.videoPackage.final_video = { status: "merging" };

  try {
    await mergeVideoFilesImpl(inputs, outputPath);
    const bytes = await readFileImpl(outputPath);
    const stored = await storeGeneratedVideoImpl(project.id, bytes, "video/mp4", "video-final");
    project.videoPackage.final_video = {
      status: "done",
      generated_video: {
        provider: "local_ffmpeg",
        model: "merge",
        generatedAt: new Date().toISOString(),
        durationSec: 20,
        ...stored
      }
    };
  } catch {
    project.videoPackage.final_video = {
      status: "unavailable",
      reason: "ffmpeg_merge_failed"
    };
  } finally {
    await unlink(outputPath).catch(() => {});
  }
  syncVideoPackageMode(project);
  return project;
}

async function submitVideoItem(
  project,
  item,
  env,
  {
    fetchImpl,
    downloadFetchImpl,
    readFileImpl,
    uploadsRootPath,
    storeGeneratedVideoImpl
  }
) {
  if (item.status === "done" && item.generated_video?.url) return item;

  const segment = scriptBySegmentId(project)[item.segment_id];
  const referenceImages = await readReferenceImageDataUrls(project, { readFileImpl, uploadsRootPath });
  const storyboardImage = await readStoryboardImageDataUrl(project, item, { readFileImpl, uploadsRootPath });
  const attemptId = randomUUID();
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  item.provider_diagnostics = createDiagnostics(item, env, storyboardImage, referenceImages, startedAt, attemptId);
  item.status = "submitting";
  delete item.error;

  try {
    const requestBody = buildVideoRequest(
      project,
      item,
      segment,
      storyboardImage,
      referenceImages,
      env.VIDEO_MODEL || DEFAULT_VIDEO_MODEL
    );
    const { payload, providerRequestId } = await postVideoGeneration(
      env.VIDEO_API_URL || DEFAULT_VIDEO_API_URL,
      env.VIDEO_MODEL_API_KEY,
      requestBody,
      positiveInteger(env.VIDEO_TIMEOUT_MS, 180000),
      fetchImpl
    );
    const result = resultFromPayload(payload);

    if (result.sourceUrl) {
      item.status = "downloading";
      const stored = await storeVideoResult(project.id, result, {
        downloadFetchImpl,
        storeGeneratedVideoImpl,
        timeoutMs: positiveInteger(env.VIDEO_DOWNLOAD_TIMEOUT_MS, 180000),
        prefix: `video-${item.segment_id}`
      });
      item.generated_video = {
        provider: "clmm-mall.top",
        model: env.VIDEO_MODEL || DEFAULT_VIDEO_MODEL,
        generatedAt: new Date().toISOString(),
        durationSec: item.duration_sec,
        aspectRatio: item.aspect_ratio,
        sourceUrl: result.sourceUrl,
        ...stored
      };
      item.status = "done";
      delete item.provider_job;
      item.provider_diagnostics = finishDiagnostics(item.provider_diagnostics, startedMs, "success", {
        providerStatus: 200,
        ...(providerRequestId ? { providerRequestId } : {}),
        outputSizeBytes: stored.size
      });
      return item;
    }

    if (!result.jobId) {
      throw new ProviderError("视频生成响应中缺少任务编号或视频地址。", {
        code: "VIDEO_PROVIDER_INVALID_OUTPUT"
      });
    }

    item.provider_job = {
      id: result.jobId,
      statusUrl: result.statusUrl || deriveStatusUrl(env.VIDEO_API_URL || DEFAULT_VIDEO_API_URL, result.jobId),
      submittedAt: startedAt
    };
    item.status = result.providerStatus || "queued";
    item.provider_diagnostics = finishDiagnostics(item.provider_diagnostics, startedMs, "submitted", {
      ...(providerRequestId ? { providerRequestId } : {})
    });
    return item;
  } catch (error) {
    markVideoItemFailed(item, error);
    item.provider_diagnostics = finishDiagnostics(item.provider_diagnostics, startedMs, "failed", {
      ...(Number.isInteger(error?.providerStatus) ? { providerStatus: error.providerStatus } : {}),
      ...(error?.providerRequestId ? { providerRequestId: error.providerRequestId } : {}),
      errorCode: error?.code || "VIDEO_PROVIDER_ERROR"
    });
    return item;
  }
}

async function refreshVideoItem(
  project,
  item,
  env,
  {
    fetchImpl,
    downloadFetchImpl,
    storeGeneratedVideoImpl
  }
) {
  if (!["queued", "generating", "downloading", "submitting"].includes(item.status)) return item;
  if (!item.provider_job?.id) return item;
  const startedMs = Date.now();
  try {
    const { payload, providerRequestId } = await fetchVideoStatus(
      item.provider_job.statusUrl || deriveStatusUrl(env.VIDEO_API_URL || DEFAULT_VIDEO_API_URL, item.provider_job.id),
      env.VIDEO_MODEL_API_KEY,
      positiveInteger(env.VIDEO_STATUS_TIMEOUT_MS, 60000),
      fetchImpl
    );
    const result = resultFromPayload(payload);
    if (result.sourceUrl) {
      item.status = "downloading";
      const stored = await storeVideoResult(project.id, result, {
        downloadFetchImpl,
        storeGeneratedVideoImpl,
        timeoutMs: positiveInteger(env.VIDEO_DOWNLOAD_TIMEOUT_MS, 180000),
        prefix: `video-${item.segment_id}`
      });
      item.generated_video = {
        provider: "clmm-mall.top",
        model: env.VIDEO_MODEL || DEFAULT_VIDEO_MODEL,
        generatedAt: new Date().toISOString(),
        durationSec: item.duration_sec,
        aspectRatio: item.aspect_ratio,
        sourceUrl: result.sourceUrl,
        ...stored
      };
      item.status = "done";
      delete item.provider_job;
      item.provider_diagnostics = {
        ...(item.provider_diagnostics || {}),
        elapsedMs: (item.provider_diagnostics?.elapsedMs || 0) + (Date.now() - startedMs),
        providerStatus: 200,
        ...(providerRequestId ? { providerRequestId } : {}),
        outputSizeBytes: stored.size,
        outcome: "success"
      };
      return item;
    }

    if (result.providerStatus) item.status = result.providerStatus;
    if (item.status === "failed") {
      throw new ProviderError("视频生成任务返回失败状态。", {
        code: "VIDEO_PROVIDER_ERROR"
      });
    }
    return item;
  } catch (error) {
    markVideoItemFailed(item, error);
    item.provider_diagnostics = {
      ...(item.provider_diagnostics || {}),
      elapsedMs: (item.provider_diagnostics?.elapsedMs || 0) + (Date.now() - startedMs),
      ...(Number.isInteger(error?.providerStatus) ? { providerStatus: error.providerStatus } : {}),
      errorCode: error?.code || "VIDEO_PROVIDER_ERROR",
      outcome: "failed"
    };
    return item;
  }
}

function videoEnv(env) {
  return {
    VIDEO_API_URL: env.VIDEO_API_URL || DEFAULT_VIDEO_API_URL,
    VIDEO_MODEL: env.VIDEO_MODEL || DEFAULT_VIDEO_MODEL,
    VIDEO_MODEL_API_KEY: env.VIDEO_MODEL_API_KEY || ""
  };
}

function assertVideoProviderConfigured(env) {
  if (!hasUsableApiKey(env.VIDEO_MODEL_API_KEY)) {
    throw new ProviderError("请先在管理后台配置视频生成 API Key。", {
      code: "VIDEO_PROVIDER_NOT_CONFIGURED"
    });
  }
}

export async function generateProjectVideos(
  project,
  requestedAt = new Date().toISOString(),
  dependencies = {}
) {
  ensureVideoPackage(project, requestedAt);
  const env = videoEnv(await loadEnv());
  assertVideoProviderConfigured(env);

  const pendingItems = project.videoPackage.video_generation.filter((item) => (
    item.status !== "done" || !item.generated_video?.url
  ));
  await Promise.all(pendingItems.map((item) => submitVideoItem(project, item, env, {
    fetchImpl: dependencies.fetchImpl || fetch,
    downloadFetchImpl: dependencies.downloadFetchImpl || fetch,
    readFileImpl: dependencies.readFileImpl || readFile,
    uploadsRootPath: dependencies.uploadsRootPath || uploadsRoot,
    storeGeneratedVideoImpl: dependencies.storeGeneratedVideoImpl || storeGeneratedProjectVideo
  })));

  syncVideoPackageMode(project);
  if (!isSingleVideoMode(project)) {
    await maybeMergeFinalVideo(project, dependencies);
  }
  return project;
}

export async function refreshProjectVideoStatus(project, dependencies = {}) {
  ensureVideoPackage(project);
  const env = videoEnv(await loadEnv());
  assertVideoProviderConfigured(env);

  const pendingItems = project.videoPackage.video_generation.filter((item) => (
    ["queued", "generating", "downloading", "submitting"].includes(item.status)
  ));
  await Promise.all(pendingItems.map((item) => refreshVideoItem(project, item, env, {
    fetchImpl: dependencies.fetchImpl || fetch,
    downloadFetchImpl: dependencies.downloadFetchImpl || fetch,
    storeGeneratedVideoImpl: dependencies.storeGeneratedVideoImpl || storeGeneratedProjectVideo
  })));

  syncVideoPackageMode(project);
  if (!isSingleVideoMode(project)) {
    await maybeMergeFinalVideo(project, dependencies);
  }
  return project;
}

export async function retryProjectVideoSegment(project, segmentId, dependencies = {}) {
  ensureVideoPackage(project);
  const env = videoEnv(await loadEnv());
  assertVideoProviderConfigured(env);

  const item = videoItemForSegment(project, segmentId);
  resetVideoItemForRetry(item);
  project.videoPackage.final_video = isSingleVideoMode(project)
    ? { status: "unavailable", reason: "single_video_mode" }
    : { status: "waiting" };
  await submitVideoItem(project, item, env, {
    fetchImpl: dependencies.fetchImpl || fetch,
    downloadFetchImpl: dependencies.downloadFetchImpl || fetch,
    readFileImpl: dependencies.readFileImpl || readFile,
    uploadsRootPath: dependencies.uploadsRootPath || uploadsRoot,
    storeGeneratedVideoImpl: dependencies.storeGeneratedVideoImpl || storeGeneratedProjectVideo
  });
  syncVideoPackageMode(project);
  if (!isSingleVideoMode(project)) {
    await maybeMergeFinalVideo(project, dependencies);
  }
  return project;
}

export function buildVideoProviderRequest(project, segmentId, item, env, storyboardImage, referenceImages) {
  return buildVideoRequest(
    project,
    item,
    scriptBySegmentId(project)[segmentId],
    storyboardImage,
    referenceImages,
    env.VIDEO_MODEL || DEFAULT_VIDEO_MODEL
  );
}

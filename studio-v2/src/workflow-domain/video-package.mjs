import { DomainError } from "./domain-error.mjs";
import { getExportReadiness } from "./export-package.mjs";

const VIDEO_SEGMENTS = Object.freeze(["0-10s", "10-20s"]);
const VIDEO_STATUSES = new Set([
  "waiting",
  "submitting",
  "queued",
  "generating",
  "downloading",
  "done",
  "failed"
]);

function scriptBySegmentId(project) {
  return {
    "0-10s": project.planningPackage?.script_20s?.segment_a_0_10s,
    "10-20s": project.planningPackage?.script_20s?.segment_b_10_20s
  };
}

function storyboardBySegmentId(project) {
  return Object.fromEntries(
    (project.imagePackage?.image_generation || [])
      .filter((item) => item?.segment_id)
      .map((item) => [item.segment_id, item])
  );
}

function emptyFinalVideo() {
  return {
    status: "waiting"
  };
}

function normalizeVideoItem(project, segmentId, existing = {}) {
  const storyboard = storyboardBySegmentId(project)[segmentId];
  const script = scriptBySegmentId(project)[segmentId];
  if (!storyboard?.generated_image?.url || !script) {
    throw new DomainError("请先生成两张当前尺寸故事板，再生成视频。", {
      code: "VIDEO_NOT_READY"
    });
  }

  const status = VIDEO_STATUSES.has(existing.status) ? existing.status : "waiting";
  return {
    asset_id: `${segmentId}_video_segment`,
    segment_id: segmentId,
    type: "video_segment",
    aspect_ratio: project.marketBrief?.outputAspectRatio || "9:16",
    duration_sec: 10,
    storyboard_asset_id: storyboard.asset_id,
    storyboard_image_url: storyboard.generated_image.url,
    status,
    script_copy: storyboard.script_copy || "",
    ...(existing.provider_job ? { provider_job: structuredClone(existing.provider_job) } : {}),
    ...(existing.provider_diagnostics ? { provider_diagnostics: structuredClone(existing.provider_diagnostics) } : {}),
    ...(existing.generated_video ? { generated_video: structuredClone(existing.generated_video) } : {}),
    ...(existing.error ? { error: structuredClone(existing.error) } : {})
  };
}

function packageMode(items) {
  if (!items.length) return "waiting";
  if (items.every((item) => item.status === "done" && item.generated_video?.url)) return "done";
  if (items.some((item) => ["submitting", "queued", "generating", "downloading"].includes(item.status))) {
    return "provider";
  }
  if (items.some((item) => item.status === "failed") || items.some((item) => item.status === "done")) {
    return "partial";
  }
  return "waiting";
}

export function ensureVideoPackage(project, requestedAt = new Date().toISOString()) {
  const readiness = getExportReadiness(project);
  if (!readiness.ready) {
    throw new DomainError("请先生成两张当前尺寸故事板，再生成视频。", {
      code: "VIDEO_NOT_READY"
    });
  }

  const existingItems = Object.fromEntries(
    (project.videoPackage?.video_generation || []).map((item) => [item.segment_id, item])
  );
  const video_generation = VIDEO_SEGMENTS.map((segmentId) => (
    normalizeVideoItem(project, segmentId, existingItems[segmentId])
  ));

  const existingFinalVideo = project.videoPackage?.final_video
    ? structuredClone(project.videoPackage.final_video)
    : emptyFinalVideo();

  project.videoPackage = {
    requestedAt: project.videoPackage?.requestedAt || requestedAt,
    aspect_ratio: project.marketBrief?.outputAspectRatio || "9:16",
    mode: packageMode(video_generation),
    video_generation,
    final_video: existingFinalVideo
  };
  if (project.videoPackage.mode !== "done") {
    project.videoPackage.final_video = emptyFinalVideo();
  }
  return project.videoPackage;
}

export function videoItemForSegment(project, segmentId) {
  ensureVideoPackage(project);
  const item = project.videoPackage.video_generation.find((entry) => entry.segment_id === segmentId);
  if (!item) {
    throw new DomainError("视频分段不存在。", {
      code: "VIDEO_SEGMENT_NOT_FOUND",
      statusCode: 404
    });
  }
  return item;
}

export function markVideoItemFailed(item, error, failedAt = new Date().toISOString()) {
  item.status = "failed";
  item.error = {
    code: error?.code || "VIDEO_PROVIDER_ERROR",
    message: error?.message || "视频生成失败。",
    retryable: Boolean(error?.retryable),
    failedAt
  };
  delete item.provider_job;
  return item;
}

export function resetVideoItemForRetry(item) {
  item.status = "waiting";
  delete item.error;
  delete item.provider_job;
  delete item.provider_diagnostics;
  delete item.generated_video;
  return item;
}

export function syncVideoPackageMode(project) {
  if (!project.videoPackage) return null;
  project.videoPackage.mode = packageMode(project.videoPackage.video_generation || []);
  if (project.videoPackage.mode !== "done" && project.videoPackage.final_video?.status === "done") {
    project.videoPackage.final_video = emptyFinalVideo();
  }
  return project.videoPackage;
}

export function allSegmentVideosDone(project) {
  return Boolean(project.videoPackage?.video_generation?.length)
    && project.videoPackage.video_generation.every((item) => (
      item.status === "done" && item.generated_video?.url
    ));
}

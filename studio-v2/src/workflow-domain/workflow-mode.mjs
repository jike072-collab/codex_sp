import { DomainError } from "./domain-error.mjs";

export const WORKFLOW_MODES = Object.freeze([
  "single_video",
  "legacy_multi_segment"
]);

export const SINGLE_VIDEO_DURATION_MIN = 5;
export const SINGLE_VIDEO_DURATION_MAX = 15;
export const SINGLE_VIDEO_DURATION_DEFAULT = 10;

function hasFullSegment(items) {
  return Array.isArray(items) && items.some((item) => item?.segment_id === "full");
}

export function projectWorkflowMode(project) {
  const explicit = String(project?.workflowMode || "").trim();
  if (WORKFLOW_MODES.includes(explicit)) return explicit;
  if (project?.planningPackage?.workflow_mode === "single_video") return "single_video";
  if (project?.planningPackage?.workflow_mode === "legacy_multi_segment") return "legacy_multi_segment";
  if (project?.planningPackage?.script_video?.segment_full) return "single_video";
  if (project?.planningPackage?.script_20s) return "legacy_multi_segment";
  if (hasFullSegment(project?.imagePackage?.image_generation)) return "single_video";
  if (hasFullSegment(project?.videoPackage?.video_generation)) return "single_video";
  if (Number.isInteger(project?.marketBrief?.videoDurationSeconds)) return "single_video";
  return "legacy_multi_segment";
}

export function isSingleVideoMode(project) {
  return projectWorkflowMode(project) === "single_video";
}

export function normalizeSingleVideoDurationSeconds(value) {
  const duration = Number(value);
  if (!Number.isInteger(duration)) return SINGLE_VIDEO_DURATION_DEFAULT;
  if (duration < SINGLE_VIDEO_DURATION_MIN || duration > SINGLE_VIDEO_DURATION_MAX) {
    return SINGLE_VIDEO_DURATION_DEFAULT;
  }
  return duration;
}

export function selectedVideoDurationSeconds(project) {
  if (!isSingleVideoMode(project)) return 20;
  return normalizeSingleVideoDurationSeconds(
    project?.marketBrief?.videoDurationSeconds
      ?? project?.planningPackage?.script_video?.total_duration_sec
  );
}

export function planningSegments(project) {
  if (isSingleVideoMode(project)) {
    const segment = project?.planningPackage?.script_video?.segment_full;
    return segment ? [segment] : [];
  }
  return [
    project?.planningPackage?.script_20s?.segment_a_0_10s,
    project?.planningPackage?.script_20s?.segment_b_10_20s
  ].filter(Boolean);
}

export function planningSegmentsById(project) {
  return Object.fromEntries(
    planningSegments(project)
      .filter((segment) => segment?.segment_id)
      .map((segment) => [segment.segment_id, segment])
  );
}

export function expectedStoryboardCount(project) {
  return isSingleVideoMode(project) ? 1 : 2;
}

export function expectedStoryboardSegmentIds(project) {
  return isSingleVideoMode(project)
    ? ["full"]
    : ["0-10s", "10-20s"];
}

function resetStages(project) {
  const stages = [];
  if (project?.planningPackage || project?.scriptGeneratedAt || project?.scriptConfirmedAt) {
    stages.push("script");
  }
  if (project?.imagePackage || project?.visualGeneratedAt || project?.visualGenerationFailure) {
    stages.push("storyboard");
  }
  if (project?.videoPackage) {
    stages.push("video");
  }
  return stages;
}

export function switchProjectWorkflowMode(project, input) {
  const workflowMode = String(input?.workflowMode || "").trim();
  if (!WORKFLOW_MODES.includes(workflowMode)) {
    throw new DomainError("请选择有效的项目功能模式。", {
      code: "INVALID_WORKFLOW_MODE"
    });
  }

  const currentMode = projectWorkflowMode(project);
  if (workflowMode === currentMode) {
    project.workflowMode = workflowMode;
    return {
      changed: false,
      reset: false,
      resetStages: []
    };
  }

  const stages = resetStages(project);
  if (stages.length && input?.confirmReset !== true) {
    const error = new DomainError(
      "切换功能模式会清除现有脚本、故事板和视频结果，请确认后重试。",
      {
        code: "WORKFLOW_MODE_RESET_REQUIRED",
        statusCode: 409
      }
    );
    error.currentWorkflowMode = currentMode;
    error.requestedWorkflowMode = workflowMode;
    error.resetStages = stages;
    throw error;
  }

  project.workflowMode = workflowMode;
  if (stages.length) {
    project.status = "script";
    project.planningPackage = null;
    project.scriptGeneratedAt = null;
    project.scriptConfirmedAt = null;
    project.imagePackage = null;
    project.videoPackage = null;
    project.manualOmniPackages = [];
    project.visualGeneratedAt = null;
    project.visualGenerationFailure = null;
  }

  return {
    changed: true,
    reset: stages.length > 0,
    resetStages: stages
  };
}

import { DomainError } from "./domain-error.mjs";
import { assertProjectStage, transitionProject } from "./project-workflow.mjs";
import { cleanString, normalizeList } from "./value-normalizers.mjs";
import {
  normalizeSingleVideoDurationSeconds
} from "./workflow-mode.mjs";

const REQUIRED_SHOT_TEXT_FIELDS = Object.freeze([
  "visual",
  "action",
  "camera",
  "selling_point",
  "localized_caption_or_vo",
  "sound",
  "transition"
]);

function invalidScript(message) {
  throw new DomainError(message, { code: "INVALID_SCRIPT" });
}

function requiredString(value, label) {
  const normalized = cleanString(value);
  if (!normalized) invalidScript(`脚本字段“${label}”不能为空。`);
  return normalized;
}

function requiredNumber(value, label) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) invalidScript(`脚本字段“${label}”必须是数字。`);
  return normalized;
}

function normalizeShots(shots, segmentId, expectedStart, expectedEnd) {
  if (!Array.isArray(shots) || !shots.length) {
    invalidScript(`${segmentId} 必须包含至少一个镜头。`);
  }

  const normalized = shots.map((input, index) => {
    const shot = {
      start_sec: requiredNumber(input?.start_sec, `${segmentId}.shots[${index}].start_sec`),
      end_sec: requiredNumber(input?.end_sec, `${segmentId}.shots[${index}].end_sec`)
    };
    if (shot.end_sec <= shot.start_sec) {
      invalidScript(`${segmentId} 第 ${index + 1} 个镜头的结束时间必须晚于开始时间。`);
    }
    for (const field of REQUIRED_SHOT_TEXT_FIELDS) {
      shot[field] = requiredString(input?.[field], `${segmentId}.shots[${index}].${field}`);
    }
    return shot;
  });

  if (normalized[0].start_sec !== expectedStart) {
    invalidScript(`${segmentId} 必须从 ${expectedStart} 秒开始。`);
  }
  if (normalized.at(-1).end_sec !== expectedEnd) {
    invalidScript(`${segmentId} 必须在 ${expectedEnd} 秒结束。`);
  }
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].start_sec !== normalized[index - 1].end_sec) {
      invalidScript(`${segmentId} 镜头时间必须连续且不能重叠。`);
    }
  }
  return normalized;
}

function normalizeSignaturePart(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "");
}

function rejectRepeatedShots(shots) {
  const parts = shots.map((shot) => ({
    visual: normalizeSignaturePart(shot.visual),
    action: normalizeSignaturePart(shot.action),
    camera: normalizeSignaturePart(shot.camera)
  }));
  const completeSignatures = parts.map((item) => (
    `${item.visual}|${item.action}|${item.camera}`
  ));
  if (new Set(completeSignatures).size !== completeSignatures.length) {
    invalidScript("模型返回的镜头内容重复，请重新生成脚本。");
  }

  if (parts.length < 2) return;
  const pairKeys = [
    ["visual", "action"],
    ["visual", "camera"],
    ["action", "camera"]
  ];
  for (const [first, second] of pairKeys) {
    const counts = new Map();
    for (const item of parts) {
      const key = `${item[first]}|${item[second]}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    if ([...counts.values()].some((count) => count > parts.length / 2)) {
      invalidScript("模型返回的镜头内容重复，请重新生成脚本。");
    }
  }
}

function normalizeSegment(input, expected) {
  if (input?.segment_id !== expected.segmentId) {
    invalidScript(`分段编号必须是 ${expected.segmentId}。`);
  }
  if (Number(input?.duration_sec) !== expected.durationSec) {
    invalidScript(`${expected.segmentId} 时长必须是 ${expected.durationSec} 秒。`);
  }
  return {
    segment_id: expected.segmentId,
    theme: requiredString(input?.theme, `${expected.segmentId}.theme`),
    duration_sec: expected.durationSec,
    shots: normalizeShots(
      input?.shots,
      expected.segmentId,
      expected.start,
      expected.end
    )
  };
}

function includesAll(actual, required) {
  const actualSet = new Set(normalizeList(actual));
  return normalizeList(required).every((item) => actualSet.has(item));
}

function validateProductLock(submittedLock, confirmedLock) {
  if (!submittedLock || !confirmedLock) invalidScript("脚本缺少已确认的产品锁定信息。");
  if (!includesAll(submittedLock.must_keep, confirmedLock.must_keep)) {
    invalidScript("脚本丢失了产品必须保持项。");
  }
  if (!includesAll(submittedLock.must_not_change, confirmedLock.must_not_change)) {
    invalidScript("脚本丢失了产品禁止修改项。");
  }
}

function normalizeLegacyScript(script) {
  if (Number(script?.total_duration_sec) !== 20) {
    invalidScript("广告脚本总时长必须是 20 秒。");
  }
  const normalized = {
    total_duration_sec: 20,
    segment_a_0_10s: normalizeSegment(script.segment_a_0_10s, {
      segmentId: "0-10s",
      start: 0,
      end: 10,
      durationSec: 10
    }),
    segment_b_10_20s: normalizeSegment(script.segment_b_10_20s, {
      segmentId: "10-20s",
      start: 10,
      end: 20,
      durationSec: 10
    })
  };
  rejectRepeatedShots([
    ...normalized.segment_a_0_10s.shots,
    ...normalized.segment_b_10_20s.shots
  ]);
  return normalized;
}

function normalizeSingleVideoScript(script, duration) {
  const normalizedDuration = normalizeSingleVideoDurationSeconds(duration);
  const normalized = {
    total_duration_sec: normalizedDuration,
    segment_full: normalizeSegment(script.segment_full, {
      segmentId: "full",
      start: 0,
      end: normalizedDuration,
      durationSec: normalizedDuration
    })
  };
  rejectRepeatedShots(normalized.segment_full.shots);
  return normalized;
}

function resolveWorkflowMode(input, confirmedLock, options) {
  const explicit = String(options?.workflowMode || input?.workflow_mode || "").trim();
  if (explicit === "single_video") return "single_video";
  if (explicit === "legacy_multi_segment") return "legacy_multi_segment";
  if (input?.script_video?.segment_full) return "single_video";
  if (Number.isInteger(options?.videoDurationSeconds)) return "single_video";
  if (confirmedLock && input?.script_20s) return "legacy_multi_segment";
  return input?.script_video ? "single_video" : "legacy_multi_segment";
}

export function normalizeConfirmedPlanningPackage(input, confirmedLock, options = {}) {
  if (!input || typeof input !== "object") invalidScript("请提交完整的脚本包。");
  validateProductLock(input.product_lock_manifest, confirmedLock);

  const workflowMode = resolveWorkflowMode(input, confirmedLock, options);
  const result = {
    mode: cleanString(input.mode, "demo"),
    workflow_mode: workflowMode,
    locale_profile: structuredClone(input.locale_profile || {}),
    product_lock_manifest: structuredClone(confirmedLock),
    selling_points: Array.isArray(input.selling_points)
      ? structuredClone(input.selling_points)
      : [],
    creative_direction: structuredClone(input.creative_direction || {}),
    localized_copy: structuredClone(input.localized_copy || {
      caption_lines: [],
      cta_options: [],
      do_not_use: []
    }),
    confirmation_summary: structuredClone(input.confirmation_summary || {
      what_to_confirm: [],
      risk_notes: []
    })
  };

  if (workflowMode === "single_video") {
    const duration = normalizeSingleVideoDurationSeconds(
      options.videoDurationSeconds
        ?? input?.script_video?.total_duration_sec
    );
    if (!input.script_video?.segment_full) {
      invalidScript("当前单视频脚本必须包含 segment_full。");
    }
    result.script_video = normalizeSingleVideoScript(input.script_video, duration);
    delete result.script_20s;
    return result;
  }

  if (!input.script_20s) {
    invalidScript("当前脚本必须包含 script_20s。");
  }
  result.script_20s = normalizeLegacyScript(input.script_20s);
  delete result.script_video;
  return result;
}

export function confirmPlanningPackage(project, input, confirmedAt = new Date().toISOString()) {
  assertProjectStage(project, "script", "确认广告脚本");
  if (!project.planningPackage || !project.scriptGeneratedAt) {
    throw new DomainError("请先生成广告脚本，再进行确认。", {
      code: "SCRIPT_GENERATION_REQUIRED"
    });
  }
  const confirmedLock = project.visionAnalysis?.product_lock_manifest;
  project.planningPackage = normalizeConfirmedPlanningPackage(input, confirmedLock, {
    workflowMode: project.workflowMode,
    videoDurationSeconds: project.marketBrief?.videoDurationSeconds
  });
  project.workflowMode = project.planningPackage.workflow_mode;
  project.scriptConfirmedAt = confirmedAt;
  transitionProject(project, "visual");
  return project;
}

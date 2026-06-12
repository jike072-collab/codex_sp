import { DomainError } from "./domain-error.mjs";
import { assertProjectStage, transitionProject } from "./project-workflow.mjs";
import { cleanString } from "./value-normalizers.mjs";
import {
  SINGLE_VIDEO_DURATION_DEFAULT,
  SINGLE_VIDEO_DURATION_MAX,
  SINGLE_VIDEO_DURATION_MIN
} from "./workflow-mode.mjs";

export const CREATIVE_THEMES = Object.freeze([
  "city-motion",
  "daily-comfort",
  "performance-detail",
  "street-style"
]);

export const CREATIVE_TONES = Object.freeze([
  "energetic",
  "clean",
  "warm",
  "bold"
]);

export const OUTPUT_ASPECT_RATIOS = Object.freeze([
  "9:16",
  "16:9",
  "1:1",
  "4:5",
  "3:4",
  "2:3"
]);

function requiredString(value, fieldName) {
  const normalized = cleanString(value);
  if (!normalized) {
    throw new DomainError(`市场创意字段“${fieldName}”不能为空。`, {
      code: "INVALID_MARKET_BRIEF"
    });
  }
  return normalized;
}

function allowedValue(value, fieldName, allowedValues) {
  const normalized = requiredString(value, fieldName);
  if (!allowedValues.includes(normalized)) {
    throw new DomainError(
      `市场创意字段“${fieldName}”不支持值“${normalized}”。`,
      { code: "INVALID_MARKET_BRIEF" }
    );
  }
  return normalized;
}

function videoDurationSeconds(value) {
  if (value === undefined || value === null || value === "") {
    return SINGLE_VIDEO_DURATION_DEFAULT;
  }
  const duration = Number(value);
  if (!Number.isInteger(duration)) {
    throw new DomainError("市场创意字段“videoDurationSeconds”必须是整数。", {
      code: "INVALID_MARKET_BRIEF"
    });
  }
  if (duration < SINGLE_VIDEO_DURATION_MIN || duration > SINGLE_VIDEO_DURATION_MAX) {
    throw new DomainError(
      `市场创意字段“videoDurationSeconds”必须在 ${SINGLE_VIDEO_DURATION_MIN}-${SINGLE_VIDEO_DURATION_MAX} 秒之间。`,
      { code: "INVALID_MARKET_BRIEF" }
    );
  }
  return duration;
}

export function normalizeMarketBrief(input) {
  return {
    targetCountry: requiredString(input?.targetCountry, "targetCountry"),
    audience: requiredString(input?.audience, "audience"),
    creativeTheme: allowedValue(input?.creativeTheme, "creativeTheme", CREATIVE_THEMES),
    coreMessage: requiredString(input?.coreMessage, "coreMessage"),
    tone: allowedValue(input?.tone, "tone", CREATIVE_TONES),
    outputAspectRatio: input?.outputAspectRatio
      ? allowedValue(input.outputAspectRatio, "outputAspectRatio", OUTPUT_ASPECT_RATIOS)
      : "9:16",
    videoDurationSeconds: videoDurationSeconds(input?.videoDurationSeconds)
  };
}

export function confirmMarketBrief(project, input, confirmedAt = new Date().toISOString()) {
  assertProjectStage(project, "market", "保存市场创意");
  if (!project.visionAnalysis || !project.reviewConfirmedAt) {
    throw new DomainError("请先完成并确认产品锁定，再保存市场创意。", {
      code: "PRODUCT_REVIEW_REQUIRED"
    });
  }

  const marketBrief = normalizeMarketBrief(input);
  project.targetCountry = marketBrief.targetCountry;
  project.audience = marketBrief.audience;
  project.marketBrief = marketBrief;
  project.marketConfirmedAt = confirmedAt;
  transitionProject(project, "script");
  return project;
}

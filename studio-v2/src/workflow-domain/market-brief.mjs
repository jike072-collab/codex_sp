import { DomainError } from "./domain-error.mjs";
import { assertProjectStage, transitionProject } from "./project-workflow.mjs";
import { cleanString } from "./value-normalizers.mjs";

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

export function normalizeMarketBrief(input) {
  return {
    targetCountry: requiredString(input?.targetCountry, "targetCountry"),
    audience: requiredString(input?.audience, "audience"),
    creativeTheme: allowedValue(input?.creativeTheme, "creativeTheme", CREATIVE_THEMES),
    coreMessage: requiredString(input?.coreMessage, "coreMessage"),
    tone: allowedValue(input?.tone, "tone", CREATIVE_TONES)
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


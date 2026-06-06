import { DomainError } from "./domain-error.mjs";

export const PROJECT_STAGES = Object.freeze([
  "assets",
  "analyzing",
  "review",
  "market",
  "script",
  "visual",
  "export"
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  assets: new Set(["analyzing"]),
  analyzing: new Set(["assets", "review"]),
  review: new Set(["market"]),
  market: new Set(["script"]),
  script: new Set(["visual"]),
  visual: new Set(["export"]),
  export: new Set()
});

export function assertProjectStage(project, expectedStage, operation = "执行此操作") {
  const actualStage = project?.status;
  if (actualStage !== expectedStage) {
    throw new DomainError(
      `项目当前处于“${actualStage || "unknown"}”阶段，不能${operation}；需要先处于“${expectedStage}”阶段。`,
      { code: "INVALID_PROJECT_STAGE" }
    );
  }
}

export function transitionProject(project, nextStage) {
  const currentStage = project?.status;
  if (!PROJECT_STAGES.includes(currentStage)) {
    throw new DomainError(`未知的项目阶段：${currentStage || "empty"}`, {
      code: "UNKNOWN_PROJECT_STAGE"
    });
  }
  if (!PROJECT_STAGES.includes(nextStage)) {
    throw new DomainError(`未知的目标阶段：${nextStage || "empty"}`, {
      code: "UNKNOWN_TARGET_STAGE"
    });
  }
  if (!ALLOWED_TRANSITIONS[currentStage].has(nextStage)) {
    throw new DomainError(`不允许项目从“${currentStage}”进入“${nextStage}”。`, {
      code: "INVALID_STAGE_TRANSITION"
    });
  }
  project.status = nextStage;
  return project;
}


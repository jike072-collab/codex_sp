import { DomainError } from "./domain-error.mjs";
import { assertProjectStage, transitionProject } from "./project-workflow.mjs";

export function confirmProductReview(project, visionAnalysis, confirmedAt = new Date().toISOString()) {
  assertProjectStage(project, "review", "确认产品锁定");
  const summary = visionAnalysis?.product_summary;
  const lock = visionAnalysis?.product_lock_manifest;
  if (
    !summary?.shoe_type ||
    !lock ||
    !Array.isArray(lock.must_keep) ||
    !lock.must_keep.length ||
    !Array.isArray(lock.must_not_change) ||
    !lock.must_not_change.length
  ) {
    throw new DomainError("产品锁定结果不完整，无法确认。", {
      code: "INVALID_PRODUCT_REVIEW"
    });
  }

  project.visionAnalysis = visionAnalysis;
  project.reviewConfirmedAt = confirmedAt;
  transitionProject(project, "market");
  return project;
}

import { DomainError } from "./domain-error.mjs";
import {
  expectedStoryboardCount,
  expectedStoryboardSegmentIds,
  isSingleVideoMode
} from "./workflow-mode.mjs";

function storyboardDeliverables(project) {
  const script = project.planningPackage || {};
  const segmentById = isSingleVideoMode(project)
    ? { full: script.script_video?.segment_full }
    : {
        "0-10s": script.script_20s?.segment_a_0_10s,
        "10-20s": script.script_20s?.segment_b_10_20s
      };
  return (project.imagePackage?.image_generation || []).map((item) => ({
    segment_id: item.segment_id,
    aspect_ratio: item.aspect_ratio,
    storyboard: structuredClone(item),
    script: structuredClone(segmentById[item.segment_id]),
    script_copy: item.script_copy || ""
  }));
}

export function getExportReadiness(project) {
  if (project?.status !== "export") {
    return { ready: false, code: "EXPORT_NOT_READY", reason: "project_status" };
  }
  if (!project.planningPackage || !project.imagePackage) {
    return { ready: false, code: "EXPORT_NOT_READY", reason: "missing_package" };
  }

  const items = project.imagePackage.image_generation;
  const expectedCount = expectedStoryboardCount(project);
  if (!Array.isArray(items) || items.length !== expectedCount) {
    return { ready: false, code: "EXPORT_NOT_READY", reason: "storyboard_count" };
  }

  const expectedAspectRatio = project.marketBrief?.outputAspectRatio || "9:16";
  const expectedSegments = new Set(expectedStoryboardSegmentIds(project));
  for (const item of items) {
    if (item?.type !== "storyboard_board") {
      return { ready: false, code: "EXPORT_NOT_READY", reason: "storyboard_type" };
    }
    if (item.aspect_ratio !== expectedAspectRatio) {
      return { ready: false, code: "EXPORT_NOT_READY", reason: "aspect_ratio" };
    }
    if (!expectedSegments.delete(item.segment_id)) {
      return { ready: false, code: "EXPORT_NOT_READY", reason: "storyboard_segment" };
    }
    if (item.status !== "done" || !item.generated_image?.url) {
      return { ready: false, code: "EXPORT_NOT_READY", reason: "storyboard_image" };
    }
  }

  return {
    ready: expectedSegments.size === 0,
    code: expectedSegments.size === 0 ? "EXPORT_READY" : "EXPORT_NOT_READY",
    reason: expectedSegments.size === 0 ? "ready" : "storyboard_segment"
  };
}

export function buildExportPackage(project, exportedAt = new Date().toISOString()) {
  const readiness = getExportReadiness(project);
  if (!readiness.ready) {
    throw new DomainError("项目交付内容不完整，无法导出。", {
      code: "EXPORT_NOT_READY"
    });
  }

  return {
    schemaVersion: 1,
    exportedAt,
    project: {
      id: project.id,
      name: project.name,
      targetCountry: project.targetCountry,
      audience: project.audience,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    },
    sourceAssets: (project.assets || []).map((asset) => ({
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size
    })),
    visionAnalysis: structuredClone(project.visionAnalysis),
    marketBrief: structuredClone(project.marketBrief),
    planningPackage: structuredClone(project.planningPackage),
    imagePackage: structuredClone(project.imagePackage),
    storyboardDeliverables: storyboardDeliverables(project),
    manualOmniPackages: [],
    qcChecklist: [...(project.imagePackage.qc_checklist || [])]
  };
}

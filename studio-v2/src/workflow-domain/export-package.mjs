import { DomainError } from "./domain-error.mjs";
import { assertProjectStage } from "./project-workflow.mjs";

export function buildExportPackage(project, exportedAt = new Date().toISOString()) {
  assertProjectStage(project, "export", "导出交付包");
  if (
    !project.planningPackage ||
    !project.imagePackage ||
    !Array.isArray(project.manualOmniPackages) ||
    project.manualOmniPackages.length !== 2
  ) {
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
    manualOmniPackages: structuredClone(project.manualOmniPackages),
    qcChecklist: [...(project.imagePackage.qc_checklist || [])]
  };
}


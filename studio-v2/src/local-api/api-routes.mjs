import { randomUUID } from "node:crypto";

import { readJsonBody, sendJson, sendJsonDownload } from "./http-helpers.mjs";
import {
  deleteProject,
  deleteProjects,
  listProjects,
  readProject,
  removeProjectAsset,
  saveProject,
  storeProjectAssets
} from "../storage/project-repository.mjs";
import {
  readAdminProviderSettings,
  readProviderStatus,
  updateAdminProviderSettings
} from "../storage/provider-settings.mjs";
import { cleanString } from "../workflow-domain/value-normalizers.mjs";
import { analyzeProject, sanitizeAnalysis } from "../ai-providers/vision-provider.mjs";
import { DomainError } from "../workflow-domain/domain-error.mjs";
import { confirmMarketBrief } from "../workflow-domain/market-brief.mjs";
import { confirmProductReview } from "../workflow-domain/product-review.mjs";
import {
  assertProjectStage,
  transitionProject
} from "../workflow-domain/project-workflow.mjs";
import { generateProjectScript } from "../ai-providers/text-provider.mjs";
import { confirmPlanningPackage } from "../workflow-domain/script-review.mjs";
import { generateProjectVisuals } from "../ai-providers/image-provider.mjs";
import { ProviderError } from "../ai-providers/provider-utils.mjs";
import { buildExportPackage } from "../workflow-domain/export-package.mjs";
import { recordVisualGenerationFailure } from "../workflow-domain/visual-package.mjs";

function projectIdsFromBody(body) {
  const projectIds = Array.isArray(body.projectIds) ? body.projectIds : [];
  if (!projectIds.length) {
    throw new DomainError("请选择至少一个项目。", {
      code: "PROJECT_IDS_REQUIRED"
    });
  }
  for (const projectId of projectIds) {
    if (typeof projectId !== "string" || !/^[a-z0-9-]+$/i.test(projectId)) {
      throw new DomainError("项目编号无效。", {
        code: "INVALID_PROJECT_ID"
      });
    }
  }
  return projectIds;
}

export async function handleApi(request, response, url) {
  if (url.pathname === "/api/settings/providers/status") {
    if (request.method === "GET") {
      return sendJson(response, 200, await readProviderStatus());
    }
    return sendJson(response, 405, { error: "Unsupported operation." });
  }

  if (url.pathname === "/api/admin/providers") {
    if (request.method === "GET") {
      return sendJson(response, 200, await readAdminProviderSettings());
    }
    if (request.method === "PUT") {
      const body = await readJsonBody(request, 64 * 1024);
      return sendJson(response, 200, await updateAdminProviderSettings(body));
    }
    return sendJson(response, 405, { error: "Unsupported operation." });
  }

  if (url.pathname === "/api/settings/providers") {
    if (request.method === "GET") {
      return sendJson(response, 200, await readProviderStatus());
    }
    if (request.method === "PUT") {
      return sendJson(response, 405, { error: "Unsupported operation." });
    }
    return sendJson(response, 405, { error: "不支持的操作。" });
  }

  if (request.method === "GET" && url.pathname === "/api/projects") {
    return sendJson(response, 200, { projects: await listProjects() });
  }

  if (request.method === "DELETE" && url.pathname === "/api/projects") {
    const body = await readJsonBody(request, 64 * 1024);
    return sendJson(response, 200, await deleteProjects(projectIdsFromBody(body)));
  }

  if (request.method === "POST" && url.pathname === "/api/projects") {
    const body = await readJsonBody(request);
    const now = new Date().toISOString();
    const project = {
      id: `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
      name: cleanString(body.name, "未命名鞋款"),
      targetCountry: cleanString(body.targetCountry, "Thailand"),
      audience: cleanString(body.audience, "日常运动与通勤人群"),
      status: "assets",
      createdAt: now,
      updatedAt: now,
      assets: [],
      visionAnalysis: null,
      reviewConfirmedAt: null,
      marketBrief: null,
      marketConfirmedAt: null,
      planningPackage: null,
      scriptGeneratedAt: null,
      scriptConfirmedAt: null,
      imagePackage: null,
      manualOmniPackages: [],
      visualGeneratedAt: null,
      visualGenerationFailure: null
    };
    await saveProject(project);
    return sendJson(response, 201, { project });
  }

  const match = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)(?:\/(.+))?$/i);
  if (!match) return false;

  const [, projectId, action] = match;
  const project = await readProject(projectId);
  if (!project) return sendJson(response, 404, { error: "项目不存在。" });

  if (request.method === "GET" && !action) {
    return sendJson(response, 200, { project });
  }

  if (request.method === "DELETE" && !action) {
    await deleteProject(projectId);
    return sendJson(response, 200, { deletedProjectId: projectId });
  }

  if (request.method === "POST" && action === "assets") {
    assertProjectStage(project, "assets", "添加商品素材");
    const body = await readJsonBody(request);
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) {
      throw new DomainError("请选择至少一张鞋子图片。", {
        code: "ASSET_REQUIRED"
      });
    }
    await storeProjectAssets(project, files);
    await saveProject(project);
    return sendJson(response, 200, { project });
  }

  const assetDeleteMatch = action?.match(/^assets\/([a-z0-9-]+)$/i);
  if (request.method === "DELETE" && assetDeleteMatch) {
    assertProjectStage(project, "assets", "删除商品素材");
    const removed = await removeProjectAsset(project, assetDeleteMatch[1]);
    if (!removed) {
      throw new DomainError("素材不存在或已被删除。", {
        code: "ASSET_NOT_FOUND"
      });
    }
    await saveProject(project);
    return sendJson(response, 200, { project });
  }

  if (request.method === "POST" && action === "analyze") {
    assertProjectStage(project, "assets", "识别商品");
    if (!project.assets.length) {
      throw new DomainError("请先上传鞋子图片。", {
        code: "ASSET_REQUIRED"
      });
    }
    transitionProject(project, "analyzing");
    await saveProject(project);
    try {
      project.visionAnalysis = sanitizeAnalysis(await analyzeProject(project));
      transitionProject(project, "review");
      await saveProject(project);
      return sendJson(response, 200, { project });
    } catch (error) {
      transitionProject(project, "assets");
      try {
        await saveProject(project);
      } catch (rollbackError) {
        console.error("Failed to roll back project after analyze failure.", {
          projectId,
          originalError: error,
          rollbackError
        });
      }
      throw error;
    }
  }

  if (request.method === "POST" && action === "review") {
    const body = await readJsonBody(request);
    const visionAnalysis = sanitizeAnalysis(body.visionAnalysis || {});
    confirmProductReview(project, visionAnalysis);
    await saveProject(project);
    return sendJson(response, 200, { project });
  }

  if (request.method === "POST" && action === "market") {
    const body = await readJsonBody(request);
    confirmMarketBrief(project, body.marketBrief);
    await saveProject(project);
    return sendJson(response, 200, { project });
  }

  if (request.method === "POST" && action === "script/generate") {
    const body = await readJsonBody(request, 64 * 1024);
    await generateProjectScript(project, undefined, {
      shotsPerSegment: body.shotsPerSegment
    });
    await saveProject(project);
    return sendJson(response, 200, { project });
  }

  if (request.method === "POST" && action === "script/confirm") {
    const body = await readJsonBody(request);
    confirmPlanningPackage(project, body.planningPackage);
    await saveProject(project);
    return sendJson(response, 200, { project });
  }

  if (request.method === "POST" && action === "visual/generate") {
    try {
      await generateProjectVisuals(project);
      await saveProject(project);
      return sendJson(response, 200, { project });
    } catch (error) {
      if (error instanceof ProviderError && String(error.code || "").startsWith("IMAGE_")) {
        recordVisualGenerationFailure(project, error);
        try {
          await saveProject(project);
        } catch (saveError) {
          console.error("Failed to save visual provider failure state.", {
            projectId,
            originalError: error,
            saveError
          });
        }
      }
      throw error;
    }
  }

  if (request.method === "GET" && action === "export") {
    const exportPackage = buildExportPackage(project);
    return sendJsonDownload(response, exportPackage, `shoe-ad-${project.id}.json`);
  }

  return sendJson(response, 405, { error: "不支持的操作。" });
}

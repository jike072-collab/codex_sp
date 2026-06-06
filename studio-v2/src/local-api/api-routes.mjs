import { randomUUID } from "node:crypto";

import { readJsonBody, sendJson, sendJsonDownload } from "./http-helpers.mjs";
import {
  deleteProject,
  listProjects,
  readProject,
  saveProject,
  storeProjectAssets
} from "../storage/project-repository.mjs";
import {
  readProviderSettings,
  updateProviderSettings
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
import { buildExportPackage } from "../workflow-domain/export-package.mjs";

export async function handleApi(request, response, url) {
  if (url.pathname === "/api/settings/providers") {
    if (request.method === "GET") {
      return sendJson(response, 200, await readProviderSettings());
    }
    if (request.method === "PUT") {
      const body = await readJsonBody(request, 64 * 1024);
      return sendJson(response, 200, await updateProviderSettings(body));
    }
    return sendJson(response, 405, { error: "不支持的操作。" });
  }

  if (request.method === "GET" && url.pathname === "/api/projects") {
    return sendJson(response, 200, { projects: await listProjects() });
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
      visualGeneratedAt: null
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
      await saveProject(project);
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
    await generateProjectScript(project);
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
    await generateProjectVisuals(project);
    await saveProject(project);
    return sendJson(response, 200, { project });
  }

  if (request.method === "GET" && action === "export") {
    const exportPackage = buildExportPackage(project);
    return sendJsonDownload(response, exportPackage, `shoe-ad-${project.id}.json`);
  }

  return sendJson(response, 405, { error: "不支持的操作。" });
}

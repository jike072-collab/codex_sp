import { randomUUID } from "node:crypto";

import { readJsonBody, sendJson } from "./http-helpers.mjs";
import {
  listProjects,
  readProject,
  saveProject,
  storeProjectAssets
} from "../storage/project-repository.mjs";
import { cleanString } from "../workflow-domain/value-normalizers.mjs";
import { analyzeProject, sanitizeAnalysis } from "../ai-providers/vision-provider.mjs";

export async function handleApi(request, response, url) {
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
      reviewConfirmedAt: null
    };
    await saveProject(project);
    return sendJson(response, 201, { project });
  }

  const match = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)(?:\/(assets|analyze|review))?$/i);
  if (!match) return false;

  const [, projectId, action] = match;
  const project = await readProject(projectId);
  if (!project) return sendJson(response, 404, { error: "项目不存在。" });

  if (request.method === "GET" && !action) {
    return sendJson(response, 200, { project });
  }

  if (request.method === "POST" && action === "assets") {
    const body = await readJsonBody(request);
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length) throw new Error("请选择至少一张鞋子图片。");
    await storeProjectAssets(project, files);
    project.status = project.assets.length ? "assets" : project.status;
    await saveProject(project);
    return sendJson(response, 200, { project });
  }

  if (request.method === "POST" && action === "analyze") {
    if (!project.assets.length) throw new Error("请先上传鞋子图片。");
    project.status = "analyzing";
    await saveProject(project);
    try {
      project.visionAnalysis = sanitizeAnalysis(await analyzeProject(project));
      project.status = "review";
      await saveProject(project);
      return sendJson(response, 200, { project });
    } catch (error) {
      project.status = "assets";
      await saveProject(project);
      throw error;
    }
  }

  if (request.method === "POST" && action === "review") {
    const body = await readJsonBody(request);
    project.visionAnalysis = sanitizeAnalysis(body.visionAnalysis || {});
    project.status = "market";
    project.reviewConfirmedAt = new Date().toISOString();
    await saveProject(project);
    return sendJson(response, 200, { project });
  }

  return sendJson(response, 405, { error: "不支持的操作。" });
}

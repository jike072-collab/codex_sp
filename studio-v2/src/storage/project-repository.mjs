import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { projectsRoot, uploadsRoot } from "../config.mjs";
import { getExportReadiness } from "../workflow-domain/export-package.mjs";
import { PROJECT_STAGES } from "../workflow-domain/project-workflow.mjs";
import { cleanString } from "../workflow-domain/value-normalizers.mjs";

export async function initializeStorage() {
  await Promise.all([
    mkdir(projectsRoot, { recursive: true }),
    mkdir(uploadsRoot, { recursive: true })
  ]);
}

function projectPath(projectId) {
  if (!/^[a-z0-9-]+$/i.test(projectId)) throw new Error("无效的项目编号。");
  return join(projectsRoot, `${projectId}.json`);
}

function safeProjectUploadPath(projectId) {
  if (!/^[a-z0-9-]+$/i.test(projectId)) throw new Error("无效的项目编号。");
  const root = resolve(uploadsRoot);
  const target = resolve(root, projectId);
  const pathFromRoot = relative(root, target);
  if (!pathFromRoot || pathFromRoot.startsWith("..") || pathFromRoot.includes(":")) {
    throw new Error("项目上传目录超出允许范围。");
  }
  return target;
}

function assertStringField(project, field) {
  if (typeof project[field] !== "string" || !project[field].trim()) {
    throw new Error(`Project is missing required string field: ${field}`);
  }
}

function assertProjectRecord(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    throw new Error("Project must be an object.");
  }
  for (const field of ["id", "name", "targetCountry", "audience", "createdAt", "updatedAt"]) {
    assertStringField(project, field);
  }
  if (!PROJECT_STAGES.includes(project.status)) {
    throw new Error(`Project has an invalid status: ${project.status || "empty"}`);
  }
  if (!Array.isArray(project.assets)) {
    throw new Error("Project assets must be an array.");
  }
}

export async function readProject(projectId) {
  try {
    return JSON.parse(await readFile(projectPath(projectId), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function saveProject(project) {
  if (!project || typeof project !== "object" || Array.isArray(project)) {
    throw new Error("Project must be an object.");
  }
  project.updatedAt = new Date().toISOString();
  assertProjectRecord(project);
  await writeFile(projectPath(project.id), JSON.stringify(project, null, 2), "utf8");
  return project;
}

export async function deleteProject(projectId) {
  const sourcePath = projectPath(projectId);
  const tombstonePath = `${sourcePath}.${randomUUID()}.deleting`;
  const uploadPath = safeProjectUploadPath(projectId);

  try {
    await rename(sourcePath, tombstonePath);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }

  try {
    await rm(uploadPath, { recursive: true, force: true });
    await unlink(tombstonePath);
    return true;
  } catch (error) {
    try {
      await rename(tombstonePath, sourcePath);
    } catch {
      // Preserve the original failure; the tombstone remains recoverable.
    }
    throw error;
  }
}

export async function deleteProjects(projectIds) {
  const uniqueIds = [...new Set(projectIds)];
  const deletedProjectIds = [];
  const missingProjectIds = [];

  for (const projectId of uniqueIds) {
    const deleted = await deleteProject(projectId);
    if (deleted) deletedProjectIds.push(projectId);
    else missingProjectIds.push(projectId);
  }

  deletedProjectIds.sort();
  missingProjectIds.sort();
  return { deletedProjectIds, missingProjectIds };
}

export async function listProjects() {
  const files = (await readdir(projectsRoot)).filter((name) => name.endsWith(".json"));
  const projects = [];
  await Promise.all(files.map(async (name) => {
    try {
      const project = JSON.parse(await readFile(join(projectsRoot, name), "utf8"));
      assertProjectRecord(project);
      projects.push(project);
    } catch (error) {
      console.error(`Skipping unreadable project file: ${name}`, error);
    }
  }));
  return projects
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(({
      visionAnalysis,
      planningPackage,
      imagePackage,
      manualOmniPackages,
      ...project
    }) => ({
      ...project,
      hasAnalysis: Boolean(visionAnalysis),
      hasPlanningPackage: Boolean(planningPackage),
      hasImagePackage: Boolean(imagePackage),
      exportReady: getExportReadiness({ ...project, planningPackage, imagePackage }).ready,
      visualNeedsRegeneration: project.status === "export"
        && !getExportReadiness({ ...project, planningPackage, imagePackage }).ready,
      omniPackageCount: Array.isArray(manualOmniPackages) ? manualOmniPackages.length : 0
    }));
}

export async function storeProjectAssets(project, files) {
  const uploadDir = join(uploadsRoot, project.id);
  await mkdir(uploadDir, { recursive: true });

  for (const file of files) {
    const matchData = cleanString(file.dataUrl).match(
      /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i
    );
    if (!matchData) throw new Error(`不支持的图片：${cleanString(file.name, "unknown")}`);
    const bytes = Buffer.from(matchData[2], "base64");
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (project.assets.some((asset) => asset.hash === hash)) continue;
    const extension = matchData[1] === "image/png"
      ? ".png"
      : matchData[1] === "image/webp"
        ? ".webp"
        : ".jpg";
    const storedName = `${randomUUID()}${extension}`;
    await writeFile(join(uploadDir, storedName), bytes);
    project.assets.push({
      id: randomUUID(),
      name: cleanString(file.name, `shoe${extension}`),
      storedName,
      mimeType: matchData[1],
      hash,
      size: bytes.length,
      uploadedAt: new Date().toISOString(),
      url: `/uploads/${project.id}/${storedName}`
    });
  }

  return project;
}

export async function removeProjectAsset(project, assetId) {
  const index = project.assets.findIndex((asset) => asset.id === assetId);
  if (index < 0) return false;

  const [asset] = project.assets.splice(index, 1);
  const uploadDir = safeProjectUploadPath(project.id);
  const target = resolve(uploadDir, asset.storedName);
  const pathFromUploadDir = relative(uploadDir, target);
  if (!pathFromUploadDir || pathFromUploadDir.startsWith("..") || pathFromUploadDir.includes(":")) {
    throw new Error("素材路径超出允许范围。");
  }
  await rm(target, { force: true });
  return true;
}

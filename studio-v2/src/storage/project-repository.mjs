import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { projectsRoot, uploadsRoot } from "../config.mjs";
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

export async function readProject(projectId) {
  try {
    return JSON.parse(await readFile(projectPath(projectId), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function saveProject(project) {
  project.updatedAt = new Date().toISOString();
  await writeFile(projectPath(project.id), JSON.stringify(project, null, 2), "utf8");
  return project;
}

export async function listProjects() {
  const files = (await readdir(projectsRoot)).filter((name) => name.endsWith(".json"));
  const projects = await Promise.all(
    files.map(async (name) => JSON.parse(await readFile(join(projectsRoot, name), "utf8")))
  );
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
      url: `/uploads/${project.id}/${storedName}`
    });
  }

  return project;
}

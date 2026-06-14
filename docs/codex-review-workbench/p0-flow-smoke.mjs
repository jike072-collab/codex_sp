import { readFile } from "node:fs/promises";

const baseUrl = process.env.STUDIO_URL || "http://127.0.0.1:8810";
const sampleImagePath = process.env.SAMPLE_IMAGE ||
  "E:/codex工作台/P001-codex_sp仓库/studio-v2/data/uploads/success-mqcnwruf/3899d01a-4cfc-44b9-be21-9659efcb5a31.png";

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...options.headers }
      : options.headers
  });
  const body = await response.json();
  return { response, body };
}

async function main() {
  const image = await readFile(sampleImagePath);
  const dataUrl = `data:image/png;base64,${image.toString("base64")}`;

  const created = await jsonRequest("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: `P0 flow smoke ${Date.now()}` })
  });
  const projectId = created.body.project.id;

  const uploaded = await jsonRequest(`/api/projects/${projectId}/assets`, {
    method: "POST",
    body: JSON.stringify({
      files: [{ name: "shoe-smoke.png", dataUrl }]
    })
  });

  const analyzed = await jsonRequest(`/api/projects/${projectId}/analyze`, {
    method: "POST"
  });

  const reviewed = await jsonRequest(`/api/projects/${projectId}/review`, {
    method: "POST",
    body: JSON.stringify({
      visionAnalysis: analyzed.body.project.visionAnalysis
    })
  });

  const setup = reviewed.body.project.marketBrief || {};
  const marketBrief = {
    targetCountry: setup.targetCountry || "Thailand",
    audience: setup.audience || "日常运动与通勤人群",
    creativeTheme: setup.creativeTheme || "city-motion",
    coreMessage: setup.coreMessage || "轻快、稳定，适合每天出发",
    tone: setup.tone || "energetic",
    outputAspectRatio: setup.outputAspectRatio || "9:16",
    videoDurationSeconds: setup.videoDurationSeconds || 10
  };

  const marketed = await jsonRequest(`/api/projects/${projectId}/market`, {
    method: "POST",
    body: JSON.stringify({ marketBrief })
  });

  const scripted = await jsonRequest(`/api/projects/${projectId}/script/generate`, {
    method: "POST",
    body: JSON.stringify({ videoDurationSeconds: 10 })
  });

  const confirmed = await jsonRequest(`/api/projects/${projectId}/script/confirm`, {
    method: "POST",
    body: JSON.stringify({
      planningPackage: scripted.body.project.planningPackage
    })
  });

  const visual = await jsonRequest(`/api/projects/${projectId}/visual/generate`, {
    method: "POST"
  });

  const reopened = await jsonRequest(`/api/projects/${projectId}`);

  const result = {
    projectId,
    statuses: {
      created: created.response.status,
      uploaded: uploaded.response.status,
      analyzed: analyzed.response.status,
      reviewed: reviewed.response.status,
      marketed: marketed.response.status,
      scripted: scripted.response.status,
      confirmed: confirmed.response.status,
      visual: visual.response.status,
      reopened: reopened.response.status
    },
    finalProjectStatus: reopened.body.project.status,
    workflowMode: reopened.body.project.workflowMode,
    assetCount: reopened.body.project.assets.length,
    storyboardCount: reopened.body.project.imagePackage?.image_generation?.length || 0,
    visualFailureCode: reopened.body.project.visualGenerationFailure?.code || "",
    visualFailureMessage: reopened.body.project.visualGenerationFailure?.message || ""
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

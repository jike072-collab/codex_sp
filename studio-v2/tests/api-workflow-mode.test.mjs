import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

let baseUrl;
let server;
let dataRoot;
let repository;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...options.headers }
      : options.headers
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

before(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "shoe-ad-workflow-mode-"));
  process.env.STUDIO_DATA_ROOT = dataRoot;
  repository = await import("../src/storage/project-repository.mjs");
  const { createRequestHandler } = await import("../src/local-api/request-handler.mjs");
  await repository.initializeStorage();

  server = http.createServer(createRequestHandler());
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  delete process.env.STUDIO_DATA_ROOT;
  const pathFromTemp = relative(resolve(tmpdir()), resolve(dataRoot));
  if (!pathFromTemp.startsWith("..") && pathFromTemp.startsWith("shoe-ad-workflow-mode-")) {
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test("new projects default to single mode and can switch before downstream generation", async () => {
  const created = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Mode project" })
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.project.workflowMode, "single_video");

  const switched = await request(`/api/projects/${created.body.project.id}/workflow-mode`, {
    method: "PUT",
    body: JSON.stringify({
      workflowMode: "legacy_multi_segment",
      confirmReset: false
    })
  });
  assert.equal(switched.status, 200);
  assert.equal(switched.body.project.workflowMode, "legacy_multi_segment");
  assert.equal(switched.body.changed, true);
  assert.equal(switched.body.reset, false);
  assert.deepEqual(switched.body.resetStages, []);
});

test("workflow mode changes require confirmation and reset only script and downstream state", async () => {
  const created = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Mode reset project" })
  });
  const project = await repository.readProject(created.body.project.id);
  project.status = "export";
  project.assets = [{
    id: "asset-1",
    name: "shoe.png",
    storedName: "shoe.png",
    mimeType: "image/png",
    hash: "hash",
    size: 1,
    url: `/uploads/${project.id}/shoe.png`
  }];
  project.visionAnalysis = {
    product_lock_manifest: {
      must_keep: ["exact silhouette"],
      must_not_change: ["do not change color"]
    }
  };
  project.reviewConfirmedAt = "2026-06-12T01:00:00.000Z";
  project.marketBrief = {
    targetCountry: "Thailand",
    audience: "Daily commuters",
    creativeTheme: "city-motion",
    coreMessage: "Daily motion",
    tone: "energetic",
    outputAspectRatio: "9:16",
    videoDurationSeconds: 10
  };
  project.marketConfirmedAt = "2026-06-12T01:10:00.000Z";
  project.planningPackage = { workflow_mode: "single_video" };
  project.scriptGeneratedAt = "2026-06-12T01:20:00.000Z";
  project.scriptConfirmedAt = "2026-06-12T01:30:00.000Z";
  project.imagePackage = { image_generation: [] };
  project.visualGeneratedAt = "2026-06-12T01:40:00.000Z";
  project.visualGenerationFailure = {
    code: "IMAGE_PROVIDER_TIMEOUT",
    message: "timeout",
    failedAt: "2026-06-12T01:41:00.000Z",
    possiblyBilled: true
  };
  project.videoPackage = { video_generation: [] };
  await repository.saveProject(project);

  const blocked = await request(`/api/projects/${project.id}/workflow-mode`, {
    method: "PUT",
    body: JSON.stringify({ workflowMode: "legacy_multi_segment" })
  });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, "WORKFLOW_MODE_RESET_REQUIRED");
  assert.equal(blocked.body.currentWorkflowMode, "single_video");
  assert.equal(blocked.body.requestedWorkflowMode, "legacy_multi_segment");
  assert.deepEqual(blocked.body.resetStages, ["script", "storyboard", "video"]);

  const unchanged = await repository.readProject(project.id);
  assert.ok(unchanged.planningPackage);
  assert.ok(unchanged.imagePackage);
  assert.ok(unchanged.videoPackage);

  const confirmed = await request(`/api/projects/${project.id}/workflow-mode`, {
    method: "PUT",
    body: JSON.stringify({
      workflowMode: "legacy_multi_segment",
      confirmReset: true
    })
  });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.project.workflowMode, "legacy_multi_segment");
  assert.equal(confirmed.body.project.status, "script");
  assert.equal(confirmed.body.reset, true);
  assert.deepEqual(confirmed.body.resetStages, ["script", "storyboard", "video"]);
  for (const field of [
    "planningPackage",
    "scriptGeneratedAt",
    "scriptConfirmedAt",
    "imagePackage",
    "videoPackage",
    "visualGeneratedAt",
    "visualGenerationFailure"
  ]) {
    assert.equal(confirmed.body.project[field], null);
  }
  assert.deepEqual(confirmed.body.project.assets, project.assets);
  assert.deepEqual(confirmed.body.project.visionAnalysis, project.visionAnalysis);
  assert.equal(confirmed.body.project.reviewConfirmedAt, project.reviewConfirmedAt);
  assert.deepEqual(confirmed.body.project.marketBrief, project.marketBrief);
  assert.equal(confirmed.body.project.marketConfirmedAt, project.marketConfirmedAt);
});

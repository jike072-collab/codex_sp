import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

let baseUrl;
let server;
let dataRoot;

const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const marketBrief = {
  targetCountry: "Thailand",
  audience: "日常运动与通勤人群",
  creativeTheme: "city-motion",
  coreMessage: "轻快、稳定，适合每天出发",
  tone: "energetic"
};

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...options.headers }
      : options.headers
  });
  return {
    response,
    body: await response.json()
  };
}

before(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "shoe-ad-studio-loop-"));
  process.env.STUDIO_DATA_ROOT = dataRoot;
  process.env.VISION_MODEL_API_KEY = "replace_me";
  process.env.TEXT_MODEL_API_KEY = "replace_me";
  process.env.IMAGE_MODEL_API_KEY = "replace_me";

  const repository = await import("../src/storage/project-repository.mjs");
  const { createRequestHandler } = await import("../src/local-api/request-handler.mjs");
  await repository.initializeStorage();

  server = http.createServer(createRequestHandler());
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  const resolvedTemp = resolve(tmpdir());
  const resolvedData = resolve(dataRoot);
  const pathFromTemp = relative(resolvedTemp, resolvedData);
  if (!pathFromTemp.startsWith("..") && pathFromTemp.startsWith("shoe-ad-studio-loop-")) {
    await rm(resolvedData, { recursive: true, force: true });
  }
});

test("no-key demo mode completes the full persisted export loop", async () => {
  const created = await jsonRequest("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      name: "Full demo loop",
      targetCountry: "Thailand",
      audience: "日常运动与通勤人群"
    })
  });
  assert.equal(created.response.status, 201);
  const projectId = created.body.project.id;

  const uploaded = await jsonRequest(`/api/projects/${projectId}/assets`, {
    method: "POST",
    body: JSON.stringify({
      files: [{ name: "shoe.png", dataUrl: tinyPng }]
    })
  });
  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.body.project.assets.length, 1);

  const analyzed = await jsonRequest(`/api/projects/${projectId}/analyze`, {
    method: "POST"
  });
  assert.equal(analyzed.response.status, 200);
  assert.equal(analyzed.body.project.status, "review");
  assert.equal(analyzed.body.project.visionAnalysis.mode, "demo");

  const reviewed = await jsonRequest(`/api/projects/${projectId}/review`, {
    method: "POST",
    body: JSON.stringify({
      visionAnalysis: analyzed.body.project.visionAnalysis
    })
  });
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.body.project.status, "market");

  const marketed = await jsonRequest(`/api/projects/${projectId}/market`, {
    method: "POST",
    body: JSON.stringify({ marketBrief })
  });
  assert.equal(marketed.response.status, 200);
  assert.equal(marketed.body.project.status, "script");

  const firstGeneration = await jsonRequest(`/api/projects/${projectId}/script/generate`, {
    method: "POST",
    body: JSON.stringify({ shotsPerSegment: 4 })
  });
  assert.equal(firstGeneration.response.status, 200);
  assert.equal(firstGeneration.body.project.status, "script");
  assert.equal(firstGeneration.body.project.planningPackage.mode, "demo");
  assert.equal(
    firstGeneration.body.project.planningPackage.script_20s.segment_a_0_10s.shots.length,
    4
  );
  assert.equal(
    firstGeneration.body.project.planningPackage.script_20s.segment_b_10_20s.shots.length,
    4
  );

  const secondGeneration = await jsonRequest(`/api/projects/${projectId}/script/generate`, {
    method: "POST",
    body: JSON.stringify({ shotsPerSegment: 4 })
  });
  assert.deepEqual(
    secondGeneration.body.project.planningPackage,
    firstGeneration.body.project.planningPackage
  );

  const editedPlanning = structuredClone(secondGeneration.body.project.planningPackage);
  editedPlanning.script_20s.segment_a_0_10s.shots[0].visual =
    "User edited product-first opening shot.";

  const confirmed = await jsonRequest(`/api/projects/${projectId}/script/confirm`, {
    method: "POST",
    body: JSON.stringify({ planningPackage: editedPlanning })
  });
  assert.equal(confirmed.response.status, 200);
  assert.equal(confirmed.body.project.status, "visual");
  assert.equal(
    confirmed.body.project.planningPackage.script_20s.segment_a_0_10s.shots[0].visual,
    "User edited product-first opening shot."
  );

  const visual = await jsonRequest(`/api/projects/${projectId}/visual/generate`, {
    method: "POST"
  });
  assert.equal(visual.response.status, 200);
  assert.equal(visual.body.project.status, "export");
  assert.equal(visual.body.project.imagePackage.image_generation.length, 4);
  assert.equal(visual.body.project.manualOmniPackages.length, 2);

  const mustKeep = visual.body.project.visionAnalysis.product_lock_manifest.must_keep;
  const mustNotChange = visual.body.project.visionAnalysis.product_lock_manifest.must_not_change;
  for (const item of visual.body.project.imagePackage.image_generation) {
    for (const rule of [...mustKeep, ...mustNotChange]) {
      assert.match(item.prompt, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }

  const reopened = await jsonRequest(`/api/projects/${projectId}`);
  assert.equal(reopened.response.status, 200);
  assert.equal(reopened.body.project.status, "export");
  assert.equal(
    reopened.body.project.planningPackage.script_20s.segment_a_0_10s.shots[0].visual,
    "User edited product-first opening shot."
  );

  const projectList = await jsonRequest("/api/projects");
  const summary = projectList.body.projects.find((item) => item.id === projectId);
  assert.equal(summary.hasPlanningPackage, true);
  assert.equal(summary.hasImagePackage, true);
  assert.equal(summary.omniPackageCount, 2);
  assert.equal("planningPackage" in summary, false);
  assert.equal("imagePackage" in summary, false);

  const exportResponse = await fetch(`${baseUrl}/api/projects/${projectId}/export`);
  assert.equal(exportResponse.status, 200);
  assert.equal(
    exportResponse.headers.get("content-disposition"),
    `attachment; filename="shoe-ad-${projectId}.json"`
  );
  const delivery = await exportResponse.json();
  assert.equal(delivery.schemaVersion, 1);
  assert.equal(delivery.manualOmniPackages.length, 2);
  assert.equal(delivery.imagePackage.image_generation.length, 4);
  assert.equal(delivery.sourceAssets[0].name, "shoe.png");
  assert.equal("storedName" in delivery.sourceAssets[0], false);
  assert.equal("hash" in delivery.sourceAssets[0], false);
  assert.equal(JSON.stringify(delivery).includes(dataRoot), false);
});

test("script confirmation rejects a broken timeline", async () => {
  const created = await jsonRequest("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Broken timeline" })
  });
  const projectId = created.body.project.id;
  const repository = await import("../src/storage/project-repository.mjs");
  const project = await repository.readProject(projectId);
  project.status = "script";
  project.visionAnalysis = {
    product_lock_manifest: {
      must_keep: ["exact shoe"],
      must_not_change: ["do not change color"]
    }
  };
  project.reviewConfirmedAt = "2026-06-06T00:00:00.000Z";
  project.marketBrief = marketBrief;
  project.marketConfirmedAt = "2026-06-06T00:00:00.000Z";
  await repository.saveProject(project);

  const generated = await jsonRequest(`/api/projects/${projectId}/script/generate`, {
    method: "POST"
  });
  const broken = structuredClone(generated.body.project.planningPackage);
  broken.script_20s.segment_a_0_10s.shots[1].start_sec = 3;

  const response = await jsonRequest(`/api/projects/${projectId}/script/confirm`, {
    method: "POST",
    body: JSON.stringify({ planningPackage: broken })
  });
  assert.equal(response.response.status, 400);
  assert.equal(response.body.code, "INVALID_SCRIPT");
});

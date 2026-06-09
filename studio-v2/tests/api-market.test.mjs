import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";

let baseUrl;
let server;
let dataRoot;
let repository;

const reviewedAnalysis = {
  mode: "reviewed",
  product_summary: {
    shoe_type: "running shoe",
    likely_usage: { value: "daily running", evidence: "inferred" },
    overall_style: "sport"
  },
  product_lock_manifest: {
    main_colors: ["blue"],
    supporting_colors: ["white"],
    upper_material_visible: "mesh",
    toe_shape: "rounded",
    lace_system: "standard",
    midsole_shape: "curved",
    outsole_color: "black",
    outsole_pattern: "visible tread",
    side_pattern_or_logo: "side graphic",
    heel_structure: "padded",
    must_keep: ["shoe silhouette"],
    must_not_change: ["sole structure"]
  },
  visible_selling_point_candidates: [],
  image_quality: {
    usable: true,
    views_detected: ["side"],
    missing_or_unclear: [],
    notes: []
  }
};

const marketBrief = {
  targetCountry: "Thailand",
  audience: "日常运动与通勤人群",
  creativeTheme: "city-motion",
  coreMessage: "轻快、稳定，适合每天出发",
  tone: "energetic",
  outputAspectRatio: "9:16"
};

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

async function createProjectAtReview() {
  const created = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({
      name: "API market test",
      targetCountry: "Vietnam",
      audience: "initial audience"
    })
  });
  const project = await repository.readProject(created.body.project.id);
  project.status = "review";
  await repository.saveProject(project);
  return project;
}

before(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "shoe-ad-studio-test-"));
  process.env.STUDIO_DATA_ROOT = dataRoot;

  repository = await import("../src/storage/project-repository.mjs");
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
  if (!pathFromTemp.startsWith("..") && pathFromTemp.startsWith("shoe-ad-studio-test-")) {
    await rm(resolvedData, { recursive: true, force: true });
  }
});

test("review then market advances the project to script", async () => {
  const project = await createProjectAtReview();
  const review = await request(`/api/projects/${project.id}/review`, {
    method: "POST",
    body: JSON.stringify({ visionAnalysis: reviewedAnalysis })
  });
  assert.equal(review.status, 200);
  assert.equal(review.body.project.status, "market");

  const market = await request(`/api/projects/${project.id}/market`, {
    method: "POST",
    body: JSON.stringify({ marketBrief })
  });
  assert.equal(market.status, 200);
  assert.equal(market.body.project.status, "script");
  assert.deepEqual(market.body.project.marketBrief, marketBrief);
  assert.ok(market.body.project.marketConfirmedAt);

  const persisted = await repository.readProject(project.id);
  assert.equal(persisted.status, "script");
  assert.deepEqual(persisted.marketBrief, marketBrief);
});

test("market rejects an invalid workflow stage with 400", async () => {
  const created = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Wrong stage" })
  });
  const response = await request(`/api/projects/${created.body.project.id}/market`, {
    method: "POST",
    body: JSON.stringify({ marketBrief })
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_PROJECT_STAGE");
});

test("market rejects undocumented creative themes with 400", async () => {
  const project = await createProjectAtReview();
  await request(`/api/projects/${project.id}/review`, {
    method: "POST",
    body: JSON.stringify({ visionAnalysis: reviewedAnalysis })
  });
  const response = await request(`/api/projects/${project.id}/market`, {
    method: "POST",
    body: JSON.stringify({
      marketBrief: { ...marketBrief, creativeTheme: "unknown-theme" }
    })
  });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_MARKET_BRIEF");
});

test("invalid JSON returns a client error rather than 500", async () => {
  const response = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{broken"
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.code, "INVALID_JSON");
});

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
  tone: "energetic",
  outputAspectRatio: "9:16"
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
  process.env.IMAGE_SECONDARY_API_KEY = "replace_me";

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

test("no-key mode keeps storyboard generation in Step 4 and blocks export", async () => {
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
  assert.equal(firstGeneration.body.project.planningPackage.workflow_mode, "single_video");
  assert.equal(firstGeneration.body.project.planningPackage.script_video.total_duration_sec, 10);
  assert.equal(
    firstGeneration.body.project.planningPackage.script_video.segment_full.shots.length,
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
  editedPlanning.script_video.segment_full.shots[0].visual =
    "User edited product-first opening shot.";

  const confirmed = await jsonRequest(`/api/projects/${projectId}/script/confirm`, {
    method: "POST",
    body: JSON.stringify({ planningPackage: editedPlanning })
  });
  assert.equal(confirmed.response.status, 200);
  assert.equal(confirmed.body.project.status, "visual");
  assert.equal(
    confirmed.body.project.planningPackage.script_video.segment_full.shots[0].visual,
    "User edited product-first opening shot."
  );

  const visual = await jsonRequest(`/api/projects/${projectId}/visual/generate`, {
    method: "POST"
  });
  assert.equal(visual.response.status, 502);
  assert.equal(visual.body.code, "IMAGE_PROVIDER_NOT_CONFIGURED");

  const reopened = await jsonRequest(`/api/projects/${projectId}`);
  assert.equal(reopened.response.status, 200);
  assert.equal(reopened.body.project.status, "visual");
  assert.equal(
    reopened.body.project.visualGenerationFailure.code,
    "IMAGE_PROVIDER_NOT_CONFIGURED"
  );
  assert.deepEqual(
    reopened.body.project.imagePackage.image_generation.map((item) => item.status),
    ["waiting"]
  );
  assert.equal(
    reopened.body.project.planningPackage.script_video.segment_full.shots[0].visual,
    "User edited product-first opening shot."
  );

  const projectList = await jsonRequest("/api/projects");
  const summary = projectList.body.projects.find((item) => item.id === projectId);
  assert.equal(summary.hasPlanningPackage, true);
  assert.equal(summary.hasImagePackage, true);
  assert.equal(summary.exportReady, false);
  assert.equal(summary.visualNeedsRegeneration, false);
  assert.equal(summary.omniPackageCount, 0);
  assert.equal("planningPackage" in summary, false);
  assert.equal("imagePackage" in summary, false);

  const exportResponse = await fetch(`${baseUrl}/api/projects/${projectId}/export`);
  assert.equal(exportResponse.status, 400);
});

test("single uploaded collage image can be analyzed by the vision provider", async () => {
  const providerRequests = [];
  const providerServer = http.createServer((req, res) => {
    providerRequests.push(req.url);
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const payload = JSON.parse(body);
      const userParts = payload.contents?.[0]?.parts || [];
      assert.equal(userParts.length, 2);
      assert.match(
        userParts[0].text,
        /如果只上传 1 个文件，也可能是一张包含正面、侧面、后跟、鞋底等角度的四视图拼图/
      );
      assert.equal(typeof userParts[1].inlineData?.data, "string");
      assert.equal(userParts[1].inlineData.data.length > 0, true);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                product_summary: {
                  shoe_type: "running shoe",
                  likely_usage: { value: "daily movement", evidence: "visible" },
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
                  side_pattern_or_logo: "side logo",
                  heel_structure: "padded",
                  must_keep: ["exact silhouette"],
                  must_not_change: ["do not change color"]
                },
                visible_selling_point_candidates: [],
                image_quality: {
                  usable: true,
                  views_detected: ["front", "side", "heel", "outsole collage"],
                  missing_or_unclear: [],
                  notes: ["single collage accepted"]
                }
              })
            }]
          }
        }]
      }));
    });
  });
  await new Promise((resolveListen, reject) => {
    providerServer.once("error", reject);
    providerServer.listen(0, "127.0.0.1", resolveListen);
  });
  const providerAddress = providerServer.address();
  const providerBaseUrl = `http://127.0.0.1:${providerAddress.port}`;

  const previousEnv = {
    VISION_MODEL_API_KEY: process.env.VISION_MODEL_API_KEY,
    VISION_API_URL: process.env.VISION_API_URL,
    VISION_MODEL: process.env.VISION_MODEL
  };
  Object.assign(process.env, {
    VISION_MODEL_API_KEY: "vision-collage-key",
    VISION_API_URL: `${providerBaseUrl}/gemini`,
    VISION_MODEL: "gemini-2.5-flash"
  });

  try {
    const created = await jsonRequest("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Single collage analyze" })
    });
    const projectId = created.body.project.id;

    const uploaded = await jsonRequest(`/api/projects/${projectId}/assets`, {
      method: "POST",
      body: JSON.stringify({
        files: [{ name: "shoe-collage.png", dataUrl: tinyPng }]
      })
    });
    assert.equal(uploaded.response.status, 200);
    assert.equal(uploaded.body.project.assets.length, 1);

    const analyzed = await jsonRequest(`/api/projects/${projectId}/analyze`, {
      method: "POST"
    });
    assert.equal(analyzed.response.status, 200);
    assert.equal(analyzed.body.project.status, "review");
    assert.equal(analyzed.body.project.visionAnalysis.mode, "api");
    assert.equal(providerRequests.length, 1);
  } finally {
    await new Promise((resolveClose) => providerServer.close(resolveClose));
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("analyze still rejects projects with zero uploaded images", async () => {
  const created = await jsonRequest("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Analyze without assets" })
  });
  const projectId = created.body.project.id;

  const response = await jsonRequest(`/api/projects/${projectId}/analyze`, {
    method: "POST"
  });
  assert.equal(response.response.status, 400);
  assert.equal(response.body.code, "ASSET_REQUIRED");
  assert.match(response.body.error, /请先上传鞋子图片/);
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
  broken.script_video.segment_full.shots[1].start_sec = 3;

  const response = await jsonRequest(`/api/projects/${projectId}/script/confirm`, {
    method: "POST",
    body: JSON.stringify({ planningPackage: broken })
  });
  assert.equal(response.response.status, 400);
  assert.equal(response.body.code, "INVALID_SCRIPT");
});

test("visual generation timeout records a retryable failure state", async () => {
  const repository = await import("../src/storage/project-repository.mjs");
  const {
    generateProjectDemoScript
  } = await import("../src/workflow-domain/demo-script.mjs");
  const {
    confirmPlanningPackage
  } = await import("../src/workflow-domain/script-review.mjs");

  const providerRequests = [];
  const providerServer = http.createServer((req, res) => {
    providerRequests.push(req.url);
    req.on("data", () => {});
    req.on("end", () => {});
    req.resume();
  });
  await new Promise((resolveListen, reject) => {
    providerServer.once("error", reject);
    providerServer.listen(0, "127.0.0.1", resolveListen);
  });
  const providerAddress = providerServer.address();
  const providerBaseUrl = `http://127.0.0.1:${providerAddress.port}`;

  const previousEnv = {
    IMAGE_MODEL_API_KEY: process.env.IMAGE_MODEL_API_KEY,
    IMAGE_SECONDARY_API_KEY: process.env.IMAGE_SECONDARY_API_KEY,
    IMAGE_MODEL_PROVIDER: process.env.IMAGE_MODEL_PROVIDER,
    IMAGE_API_URL: process.env.IMAGE_API_URL,
    IMAGE_SECONDARY_API_URL: process.env.IMAGE_SECONDARY_API_URL,
    IMAGE_SECONDARY_MODEL: process.env.IMAGE_SECONDARY_MODEL,
    IMAGE_TIMEOUT_MS: process.env.IMAGE_TIMEOUT_MS
  };
  Object.assign(process.env, {
    IMAGE_MODEL_API_KEY: "test-right-code-key-1111",
    IMAGE_SECONDARY_API_KEY: "test-right-code-key-2222",
    IMAGE_MODEL_PROVIDER: "right_codes",
    IMAGE_API_URL: `${providerBaseUrl}/draw-a/v1/images/generations`,
    IMAGE_SECONDARY_API_URL: `${providerBaseUrl}/draw-b/v1/images/generations`,
    IMAGE_SECONDARY_MODEL: "gpt-image-2",
    IMAGE_TIMEOUT_MS: "50"
  });

  try {
    const created = await jsonRequest("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: "Timed storyboard generation",
        targetCountry: "Thailand",
        audience: "日常运动与通勤人群"
      })
    });
    const projectId = created.body.project.id;

    await jsonRequest(`/api/projects/${projectId}/assets`, {
      method: "POST",
      body: JSON.stringify({
        files: [{ name: "shoe.png", dataUrl: tinyPng }]
      })
    });

    const project = await repository.readProject(projectId);
    project.status = "script";
    project.reviewConfirmedAt = "2026-06-06T00:10:00.000Z";
    project.visionAnalysis = {
      product_lock_manifest: {
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      }
    };
    project.marketBrief = marketBrief;
    project.marketConfirmedAt = "2026-06-06T00:20:00.000Z";
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z", {
      shotsPerSegment: 4
    });
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );
    await repository.saveProject(project);

    const response = await jsonRequest(`/api/projects/${projectId}/visual/generate`, {
      method: "POST"
    });
    assert.equal(response.response.status, 502);
    assert.equal(response.body.code, "IMAGE_PROVIDER_TIMEOUT");
    assert.equal(response.body.retryable, true);
    assert.equal(response.body.possiblyBilled, true);

    const reopened = await jsonRequest(`/api/projects/${projectId}`);
    assert.equal(reopened.body.project.status, "visual");
    assert.equal(reopened.body.project.visualGenerationFailure.code, "IMAGE_PROVIDER_TIMEOUT");
    assert.equal(reopened.body.project.visualGenerationFailure.possiblyBilled, true);
    assert.equal(reopened.body.project.visualGenerationFailure.retryable, true);
    assert.equal(
      reopened.body.project.visualGenerationFailure.providerDiagnostics.evidence.concurrentAttemptCount,
      1
    );
    assert.equal(
      reopened.body.project.visualGenerationFailure.providerDiagnostics.evidence.sameReferencePayload,
      true
    );
    assert.deepEqual(
      reopened.body.project.visualGenerationFailure.providerDiagnostics.evidence.drawChannelIds,
      ["primary"]
    );
    assert.equal(
      reopened.body.project.visualGenerationFailure.providerDiagnostics.evidence.conclusion,
      "provider_error_after_request"
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        reopened.body.project.visualGenerationFailure.providerDiagnostics.attempts[0],
        "prompt"
      ),
      false
    );
    assert.equal(reopened.body.project.visualGeneratedAt, null);
    assert.equal(reopened.body.project.imagePackage.image_generation.length, 1);
    assert.equal(providerRequests.length, 1);

    const projectList = await jsonRequest("/api/projects");
    const summary = projectList.body.projects.find((item) => item.id === projectId);
    assert.equal(summary.status, "visual");
    assert.equal(summary.hasImagePackage, true);
    assert.equal(summary.exportReady, false);
    assert.equal(summary.visualGenerationFailure.code, "IMAGE_PROVIDER_TIMEOUT");
    assert.equal("imagePackage" in summary, false);
  } finally {
    await new Promise((resolveClose) => providerServer.close(resolveClose));
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

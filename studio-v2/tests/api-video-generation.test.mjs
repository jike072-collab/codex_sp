import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

let baseUrl;
let server;
let dataRoot;
let repository;

const tinyPngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);
const tinyMp4Bytes = Buffer.from("00000018667479706d703432000000006d7034326d703431", "hex");

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...options.headers }
      : options.headers
  });
  return response;
}

async function seedReadyProject(projectId) {
  const uploadDir = join(dataRoot, "uploads", projectId);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, "shoe-collage.png"), tinyPngBytes);
  await writeFile(join(uploadDir, "storyboard-full.png"), tinyPngBytes);

  const project = {
    id: projectId,
    name: "Video API project",
    targetCountry: "Thailand",
    audience: "Daily commuters",
    workflowMode: "single_video",
    status: "export",
    createdAt: "2026-06-12T02:00:00.000Z",
    updatedAt: "2026-06-12T02:00:00.000Z",
    assets: [{
      id: "asset-1",
      name: "shoe-collage.png",
      storedName: "shoe-collage.png",
      mimeType: "image/png",
      hash: "asset-hash",
      size: tinyPngBytes.length,
      url: `/uploads/${projectId}/shoe-collage.png`
    }],
    marketBrief: {
      targetCountry: "Thailand",
      audience: "Daily commuters",
      creativeTheme: "daily-comfort",
      coreMessage: "Light and stable",
      tone: "clean",
      outputAspectRatio: "4:5",
      videoDurationSeconds: 12
    },
    planningPackage: {
      mode: "confirmed",
      workflow_mode: "single_video",
      locale_profile: {},
      product_lock_manifest: {},
      selling_points: [],
      creative_direction: {},
      localized_copy: {},
      confirmation_summary: {},
      script_video: {
        total_duration_sec: 12,
        segment_full: {
          segment_id: "full",
          theme: "full-video",
          duration_sec: 12,
          shots: [{
            start_sec: 0,
            end_sec: 6,
            visual: "Hero shoe",
            action: "Rotate shoe",
            camera: "Orbit",
            selling_point: "Breathable upper",
            localized_caption_or_vo: "Cloud-light comfort",
            sound: "Light beat",
            transition: "Cut"
          }, {
            start_sec: 6,
            end_sec: 12,
            visual: "Lifestyle walk",
            action: "Walk forward",
            camera: "Tracking",
            selling_point: "Stable support",
            localized_caption_or_vo: "Move easy all day",
            sound: "Street ambience",
            transition: "Hold"
          }]
        }
      }
    },
    imagePackage: {
      mode: "api",
      storyboard_plan: {},
      qc_checklist: [],
      image_generation: [
        {
          asset_id: "storyboard-full",
          segment_id: "full",
          type: "storyboard_board",
          aspect_ratio: "4:5",
          prompt: "a",
          negative_prompt: "b",
          reference_policy: "img2img-only",
          status: "done",
          script_copy: "full video script copy",
          generated_image: {
            provider: "Right Code",
            model: "gpt-image-2",
            url: `/uploads/${projectId}/storyboard-full.png`,
            size: "1536x1024",
            storedName: "storyboard-full.png",
            mimeType: "image/png"
          }
        }
      ]
    },
    videoPackage: null,
    manualOmniPackages: [],
    visualGeneratedAt: "2026-06-12T02:20:00.000Z",
    visualGenerationFailure: null
  };
  await repository.saveProject(project);
  return project;
}

before(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "shoe-ad-video-api-"));
  process.env.STUDIO_DATA_ROOT = dataRoot;
  process.env.STUDIO_ENV_PATH = join(dataRoot, ".env");

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
  delete process.env.STUDIO_DATA_ROOT;
  delete process.env.STUDIO_ENV_PATH;
  delete process.env.VIDEO_MODEL_API_KEY;
  delete process.env.VIDEO_API_URL;
  delete process.env.VIDEO_MODEL;
  const resolvedTemp = resolve(tmpdir());
  const resolvedData = resolve(dataRoot);
  const pathFromTemp = relative(resolvedTemp, resolvedData);
  if (!pathFromTemp.startsWith("..") && pathFromTemp.startsWith("shoe-ad-video-api-")) {
    await rm(resolvedData, { recursive: true, force: true });
  }
});

test("video API routes generate, poll status, and stream segment downloads", async () => {
  const projectId = "video-api-project";
  await seedReadyProject(projectId);

  const providerRequests = [];
  const providerServer = http.createServer(async (req, res) => {
    providerRequests.push(req.url);
    if (req.method === "POST" && req.url === "/video/v1/videos/generations") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body);
      assert.equal(payload.duration, 12);
      res.writeHead(200, {
        "Content-Type": "application/json",
        "x-request-id": "submit-full"
      });
      res.end(JSON.stringify({
        id: "job-full",
        status: "queued",
        status_url: `http://127.0.0.1:${providerServer.address().port}/status/full`
      }));
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/status/")) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "x-request-id": "status-full"
      });
      res.end(JSON.stringify({
        status: "completed",
        url: `http://127.0.0.1:${providerServer.address().port}/download/full.mp4`,
        mime_type: "video/mp4"
      }));
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/download/")) {
      res.writeHead(200, { "Content-Type": "video/mp4" });
      res.end(tinyMp4Bytes);
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unexpected" }));
  });

  await new Promise((resolveListen, reject) => {
    providerServer.once("error", reject);
    providerServer.listen(0, "127.0.0.1", resolveListen);
  });

  try {
    process.env.VIDEO_MODEL_API_KEY = "video-key";
    process.env.VIDEO_API_URL = `http://127.0.0.1:${providerServer.address().port}/video/v1/videos/generations`;
    process.env.VIDEO_MODEL = "seedance2.0 720p-fast";

    const generateResponse = await request(`/api/projects/${projectId}/videos/generate`, {
      method: "POST"
    });
    assert.equal(generateResponse.status, 200);
    const generatedBody = await generateResponse.json();
    assert.equal(generatedBody.project.videoPackage.video_generation.length, 1);
    assert.equal(providerRequests.filter((url) => url === "/video/v1/videos/generations").length, 1);
    assert.deepEqual(
      generatedBody.project.videoPackage.video_generation.map((item) => item.status),
      ["queued"]
    );

    const statusResponse = await request(`/api/projects/${projectId}/videos/status`);
    assert.equal(statusResponse.status, 200);
    const statusBody = await statusResponse.json();
    assert.deepEqual(
      statusBody.project.videoPackage.video_generation.map((item) => item.status),
      ["done"]
    );
    assert.equal(
      statusBody.project.videoPackage.video_generation.every((item) => item.generated_video?.url),
      true
    );
    assert.equal(statusBody.project.videoPackage.final_video.status, "unavailable");
    assert.equal(statusBody.project.videoPackage.final_video.reason, "single_video_mode");

    const download = await request(`/api/projects/${projectId}/videos/full/download`);
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type"), /video\/mp4/);
    assert.match(download.headers.get("content-disposition"), /\.mp4/);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), tinyMp4Bytes);
  } finally {
    await new Promise((resolveClose) => providerServer.close(resolveClose));
  }
});

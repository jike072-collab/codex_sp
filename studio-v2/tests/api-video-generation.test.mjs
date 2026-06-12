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
  await writeFile(join(uploadDir, "storyboard-a.png"), tinyPngBytes);
  await writeFile(join(uploadDir, "storyboard-b.png"), tinyPngBytes);

  const project = {
    id: projectId,
    name: "Video API project",
    targetCountry: "Thailand",
    audience: "Daily commuters",
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
      outputAspectRatio: "4:5"
    },
    planningPackage: {
      mode: "confirmed",
      locale_profile: {},
      product_lock_manifest: {},
      selling_points: [],
      creative_direction: {},
      localized_copy: {},
      confirmation_summary: {},
      script_20s: {
        total_duration_sec: 20,
        segment_a_0_10s: {
          segment_id: "0-10s",
          theme: "segment-a",
          duration_sec: 10,
          shots: [{
            start_sec: 0,
            end_sec: 10,
            visual: "Hero shoe",
            action: "Rotate shoe",
            camera: "Orbit",
            selling_point: "Breathable upper",
            localized_caption_or_vo: "Cloud-light comfort",
            sound: "Light beat",
            transition: "Cut"
          }]
        },
        segment_b_10_20s: {
          segment_id: "10-20s",
          theme: "segment-b",
          duration_sec: 10,
          shots: [{
            start_sec: 10,
            end_sec: 20,
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
          asset_id: "storyboard-a",
          segment_id: "0-10s",
          type: "storyboard_board",
          aspect_ratio: "4:5",
          prompt: "a",
          negative_prompt: "b",
          reference_policy: "img2img-only",
          status: "done",
          script_copy: "0-10s script copy",
          generated_image: {
            provider: "Right Code",
            model: "gpt-image-2",
            url: `/uploads/${projectId}/storyboard-a.png`,
            size: "1536x1024",
            storedName: "storyboard-a.png",
            mimeType: "image/png"
          }
        },
        {
          asset_id: "storyboard-b",
          segment_id: "10-20s",
          type: "storyboard_board",
          aspect_ratio: "4:5",
          prompt: "c",
          negative_prompt: "d",
          reference_policy: "img2img-only",
          status: "done",
          script_copy: "10-20s script copy",
          generated_image: {
            provider: "Right Code",
            model: "gpt-image-2",
            url: `/uploads/${projectId}/storyboard-b.png`,
            size: "1536x1024",
            storedName: "storyboard-b.png",
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
  delete process.env.VIDEO_API_KEY;
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
      const segmentId = payload.prompt.includes("ONLY 10-20s") ? "10-20s" : "0-10s";
      res.writeHead(200, {
        "Content-Type": "application/json",
        "x-request-id": `submit-${segmentId}`
      });
      res.end(JSON.stringify({
        id: `job-${segmentId}`,
        status: "queued",
        status_url: `http://127.0.0.1:${providerServer.address().port}/status/${segmentId}`
      }));
      return;
    }
    if (req.method === "GET" && req.url.startsWith("/status/")) {
      const segmentId = req.url.endsWith("/10-20s") ? "10-20s" : "0-10s";
      res.writeHead(200, {
        "Content-Type": "application/json",
        "x-request-id": `status-${segmentId}`
      });
      res.end(JSON.stringify({
        status: "completed",
        url: `http://127.0.0.1:${providerServer.address().port}/download/${segmentId}.mp4`,
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
    process.env.VIDEO_API_KEY = "video-key";
    process.env.VIDEO_API_URL = `http://127.0.0.1:${providerServer.address().port}/video/v1/videos/generations`;
    process.env.VIDEO_MODEL = "seedance2.0 720p-fast";

    const generateResponse = await request(`/api/projects/${projectId}/videos/generate`, {
      method: "POST"
    });
    assert.equal(generateResponse.status, 200);
    const generatedBody = await generateResponse.json();
    assert.equal(generatedBody.project.videoPackage.video_generation.length, 2);
    assert.equal(providerRequests.filter((url) => url === "/video/v1/videos/generations").length, 2);
    assert.deepEqual(
      generatedBody.project.videoPackage.video_generation.map((item) => item.status),
      ["queued", "queued"]
    );

    const statusResponse = await request(`/api/projects/${projectId}/videos/status`);
    assert.equal(statusResponse.status, 200);
    const statusBody = await statusResponse.json();
    assert.deepEqual(
      statusBody.project.videoPackage.video_generation.map((item) => item.status),
      ["done", "done"]
    );
    assert.equal(
      statusBody.project.videoPackage.video_generation.every((item) => item.generated_video?.url),
      true
    );
    assert.equal(["done", "unavailable"].includes(statusBody.project.videoPackage.final_video.status), true);

    const downloadA = await request(`/api/projects/${projectId}/videos/0-10s/download`);
    assert.equal(downloadA.status, 200);
    assert.match(downloadA.headers.get("content-type"), /video\/mp4/);
    assert.match(downloadA.headers.get("content-disposition"), /\.mp4/);
    assert.deepEqual(Buffer.from(await downloadA.arrayBuffer()), tinyMp4Bytes);

    const downloadB = await request(`/api/projects/${projectId}/videos/10-20s/download`);
    assert.equal(downloadB.status, 200);
    assert.match(downloadB.headers.get("content-type"), /video\/mp4/);
    assert.deepEqual(Buffer.from(await downloadB.arrayBuffer()), tinyMp4Bytes);
  } finally {
    await new Promise((resolveClose) => providerServer.close(resolveClose));
  }
});

import assert from "node:assert/strict";
import http from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

const tinyPngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);
const tinyMp4Bytes = Buffer.from("00000018667479706d703432000000006d7034326d703431", "hex");

async function jsonRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...options.headers }
      : options.headers
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { response, body };
}

async function seedReadySingleVideoProject({ dataRoot, repository, projectId }) {
  const uploadDir = join(dataRoot, "uploads", projectId);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, "shoe-collage.png"), tinyPngBytes);
  await writeFile(join(uploadDir, "storyboard-full.png"), tinyPngBytes);

  await repository.saveProject({
    id: projectId,
    name: "P0 video success smoke",
    targetCountry: "Thailand",
    audience: "Daily commuters",
    workflowMode: "single_video",
    status: "export",
    createdAt: "2026-06-14T02:00:00.000Z",
    updatedAt: "2026-06-14T02:00:00.000Z",
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
      image_generation: [{
        asset_id: "storyboard-full",
        segment_id: "full",
        type: "storyboard_board",
        aspect_ratio: "4:5",
        prompt: "storyboard prompt",
        negative_prompt: "",
        reference_policy: "img2img-only",
        status: "done",
        script_copy: "full video script copy",
        generated_image: {
          url: `/uploads/${projectId}/storyboard-full.png`,
          size: "1536x1024",
          storedName: "storyboard-full.png",
          mimeType: "image/png"
        }
      }]
    },
    videoPackage: null,
    manualOmniPackages: [],
    visualGeneratedAt: "2026-06-14T02:20:00.000Z",
    visualGenerationFailure: null
  });
}

async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return {
    server,
    baseUrl: `http://127.0.0.1:${server.address().port}`
  };
}

async function main() {
  const dataRoot = await mkdtemp(join(tmpdir(), "shoe-ad-video-success-"));
  process.env.STUDIO_DATA_ROOT = dataRoot;
  process.env.STUDIO_ENV_PATH = join(dataRoot, ".env");
  await writeFile(join(dataRoot, ".env"), "");

  const repository = await import("../../studio-v2/src/storage/project-repository.mjs");
  const { createRequestHandler } = await import("../../studio-v2/src/local-api/request-handler.mjs");
  await repository.initializeStorage();

  const projectId = "p0-video-success-smoke";
  await seedReadySingleVideoProject({ dataRoot, repository, projectId });

  const providerRequests = [];
  const provider = await startServer(async (req, res) => {
    providerRequests.push(req.url);
    if (req.method === "POST" && req.url === "/video/v1/videos/generations") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body);
      assert.equal(payload.duration, 12);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        id: "video-job-full",
        status: "queued",
        status_url: `${provider.baseUrl}/status/full`
      }));
      return;
    }
    if (req.method === "GET" && req.url === "/status/full") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "completed",
        url: `${provider.baseUrl}/download/full.mp4`,
        mime_type: "video/mp4"
      }));
      return;
    }
    if (req.method === "GET" && req.url === "/download/full.mp4") {
      res.writeHead(200, { "Content-Type": "video/mp4" });
      res.end(tinyMp4Bytes);
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unexpected provider route" }));
  });

  const app = await startServer(createRequestHandler());

  try {
    process.env.VIDEO_MODEL_API_KEY = "video-key";
    process.env.VIDEO_API_URL = `${provider.baseUrl}/video/v1/videos/generations`;
    process.env.VIDEO_MODEL = "seedance2.0 720p-fast";

    const generate = await jsonRequest(app.baseUrl, `/api/projects/${projectId}/videos/generate`, {
      method: "POST"
    });
    assert.equal(generate.response.status, 200);
    assert.equal(generate.body.project.videoPackage.video_generation.length, 1);
    assert.deepEqual(
      generate.body.project.videoPackage.video_generation.map((item) => item.status),
      ["queued"]
    );
    assert.equal(providerRequests.filter((url) => url === "/video/v1/videos/generations").length, 1);

    const status = await jsonRequest(app.baseUrl, `/api/projects/${projectId}/videos/status`);
    assert.equal(status.response.status, 200);
    assert.deepEqual(
      status.body.project.videoPackage.video_generation.map((item) => item.status),
      ["done"]
    );
    assert.equal(Boolean(status.body.project.videoPackage.video_generation[0].generated_video?.url), true);
    assert.equal(status.body.project.videoPackage.final_video.status, "unavailable");
    assert.equal(status.body.project.videoPackage.final_video.reason, "single_video_mode");

    const download = await fetch(`${app.baseUrl}/api/projects/${projectId}/videos/full/download`);
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type"), /video\/mp4/);
    assert.match(download.headers.get("content-disposition"), /\.mp4/);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), tinyMp4Bytes);

    console.log(JSON.stringify({
      projectId,
      workflowMode: status.body.project.workflowMode,
      generatedVideos: status.body.project.videoPackage.video_generation.length,
      segmentStatus: status.body.project.videoPackage.video_generation[0].status,
      finalVideoStatus: status.body.project.videoPackage.final_video.status,
      downloadStatus: download.status,
      downloadBytes: tinyMp4Bytes.length
    }, null, 2));
  } finally {
    await new Promise((resolveClose) => app.server.close(resolveClose));
    await new Promise((resolveClose) => provider.server.close(resolveClose));
    delete process.env.STUDIO_DATA_ROOT;
    delete process.env.STUDIO_ENV_PATH;
    delete process.env.VIDEO_MODEL_API_KEY;
    delete process.env.VIDEO_API_URL;
    delete process.env.VIDEO_MODEL;
    const resolvedTemp = resolve(tmpdir());
    const resolvedData = resolve(dataRoot);
    const pathFromTemp = relative(resolvedTemp, resolvedData);
    if (!pathFromTemp.startsWith("..") && pathFromTemp.startsWith("shoe-ad-video-success-")) {
      await rm(resolvedData, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

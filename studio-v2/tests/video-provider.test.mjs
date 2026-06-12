import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVideoProviderRequest,
  generateProjectVideos,
  refreshProjectVideoStatus,
  retryProjectVideoSegment
} from "../src/ai-providers/video-provider.mjs";
import { ensureVideoPackage } from "../src/workflow-domain/video-package.mjs";

const providerEnvKeys = [
  "VIDEO_API_KEY",
  "VIDEO_API_URL",
  "VIDEO_MODEL"
];

const tinyMp4Bytes = Buffer.from("00000018667479706d703432000000006d7034326d703431", "hex");
const storyboardBytes = Buffer.from("storyboard-sheet");
const referenceBytes = Buffer.from("reference-shoe");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function withTimeout(promise, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), 1000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function withProviderEnv(values, callback) {
  const previous = Object.fromEntries(providerEnvKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    return await callback();
  } finally {
    for (const key of providerEnvKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function readyProject() {
  return {
    id: "video-project",
    name: "Video project",
    targetCountry: "Thailand",
    audience: "Daily commuters",
    status: "export",
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
    assets: [{
      id: "asset-1",
      name: "shoe-collage.png",
      storedName: "shoe-collage.png",
      mimeType: "image/png",
      hash: "asset-hash",
      size: referenceBytes.length,
      url: "/uploads/video-project/shoe-collage.png"
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
          shots: [
            {
              start_sec: 0,
              end_sec: 5,
              visual: "Hero shoe turntable",
              action: "Shoe rotates slowly",
              camera: "Medium orbit",
              selling_point: "Breathable upper",
              localized_caption_or_vo: "Cloud-light comfort",
              sound: "Light beat",
              transition: "Cut"
            },
            {
              start_sec: 5,
              end_sec: 10,
              visual: "Close outsole detail",
              action: "Tilt to tread",
              camera: "Macro push-in",
              selling_point: "Stable traction",
              localized_caption_or_vo: "Grip for daily motion",
              sound: "Soft whoosh",
              transition: "Fade"
            }
          ]
        },
        segment_b_10_20s: {
          segment_id: "10-20s",
          theme: "segment-b",
          duration_sec: 10,
          shots: [
            {
              start_sec: 10,
              end_sec: 15,
              visual: "Lifestyle walking scene",
              action: "Step through city sidewalk",
              camera: "Tracking low angle",
              selling_point: "All-day cushioning",
              localized_caption_or_vo: "Move easy from morning to night",
              sound: "Street ambience",
              transition: "Cut"
            },
            {
              start_sec: 15,
              end_sec: 20,
              visual: "Packshot with logo",
              action: "Lock on final frame",
              camera: "Centered static",
              selling_point: "Clean finish",
              localized_caption_or_vo: "One pair, every day",
              sound: "Brand sting",
              transition: "Hold"
            }
          ]
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
            url: "/uploads/video-project/storyboard-a.png",
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
            url: "/uploads/video-project/storyboard-b.png",
            size: "1536x1024",
            storedName: "storyboard-b.png",
            mimeType: "image/png"
          }
        }
      ]
    },
    videoPackage: null,
    manualOmniPackages: [],
    visualGeneratedAt: "2026-06-12T00:20:00.000Z",
    visualGenerationFailure: null
  };
}

function readFileByStoredName(path) {
  if (String(path).includes("shoe-collage.png")) return referenceBytes;
  if (String(path).includes("storyboard-")) return storyboardBytes;
  throw new Error(`unexpected file read: ${path}`);
}

test("video provider request includes storyboard sheet, product references, script copy, and aspect ratio", () => {
  const project = readyProject();
  const videoPackage = ensureVideoPackage(project, "2026-06-12T01:00:00.000Z");
  const item = videoPackage.video_generation[0];

  const request = buildVideoProviderRequest(
    project,
    "0-10s",
    item,
    {
      VIDEO_MODEL: "seedance2.0 720p-fast"
    },
    {
      dataUrl: "data:image/png;base64,AAAA",
      byteLength: storyboardBytes.length
    },
    [{
      dataUrl: "data:image/png;base64,BBBB",
      byteLength: referenceBytes.length
    }]
  );

  assert.equal(request.model, "seedance2.0 720p-fast");
  assert.equal(request.duration, 10);
  assert.equal(request.resolution, "720p");
  assert.equal(request.aspect_ratio, "4:5");
  assert.deepEqual(request.image, [
    "data:image/png;base64,AAAA",
    "data:image/png;base64,BBBB"
  ]);
  assert.match(request.prompt, /ONLY 0-10s/);
  assert.match(request.prompt, /0-10s script copy/);
  assert.match(request.prompt, /4:5/);
  assert.match(request.prompt, /Use the attached storyboard sheet as the primary visual plan/);
});

test("video generation submits both segments concurrently and stores successful local videos", async () => {
  await withProviderEnv({
    VIDEO_API_KEY: "video-key",
    VIDEO_API_URL: "https://video.example.test/v1/videos/generations",
    VIDEO_MODEL: "seedance2.0 720p-fast"
  }, async () => {
    const project = readyProject();
    const requests = [];
    const releases = [];
    const bothRequestsArrived = deferred();
    let storedVideos = 0;

    const generationPromise = generateProjectVideos(project, "2026-06-12T01:10:00.000Z", {
      readFileImpl: async (path) => readFileByStoredName(path),
      fetchImpl: async (url, options) => {
        const body = JSON.parse(options.body);
        requests.push({ url, authorization: options.headers.Authorization, body });
        const release = deferred();
        releases.push(release);
        if (requests.length === 2) bothRequestsArrived.resolve();
        await release.promise;
        return new Response(JSON.stringify({
          data: [{ url: `https://cdn.example.test/${requests.length}.mp4` }]
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "x-request-id": `submit-${requests.length}` }
        });
      },
      downloadFetchImpl: async (url) => new Response(tinyMp4Bytes, {
        status: 200,
        headers: { "Content-Type": "video/mp4", "x-source-url": url }
      }),
      storeGeneratedVideoImpl: async (projectId, bytes, mimeType, prefix) => {
        storedVideos += 1;
        assert.equal(mimeType, "video/mp4");
        assert.deepEqual(bytes, tinyMp4Bytes);
        return {
          url: `/uploads/${projectId}/${prefix}-${storedVideos}.mp4`,
          storedName: `${prefix}-${storedVideos}.mp4`,
          mimeType,
          size: bytes.length
        };
      },
      ffmpegAvailableImpl: async () => false
    });

    await withTimeout(
      bothRequestsArrived.promise,
      "Timed out waiting for both video provider requests to overlap."
    );
    assert.equal(requests.length, 2);
    assert.equal(releases.length, 2);
    assert.equal(requests[0].authorization, "Bearer video-key");
    assert.equal(requests[1].authorization, "Bearer video-key");
    assert.equal(requests[0].body.aspect_ratio, "4:5");
    assert.equal(requests[1].body.aspect_ratio, "4:5");
    assert.equal(requests[0].body.image.length, 2);
    assert.equal(requests[1].body.image.length, 2);

    releases[0].resolve();
    releases[1].resolve();
    await generationPromise;

    assert.equal(storedVideos, 2);
    assert.deepEqual(
      project.videoPackage.video_generation.map((item) => item.status),
      ["done", "done"]
    );
    assert.equal(project.videoPackage.mode, "done");
    assert.equal(project.videoPackage.final_video.status, "unavailable");
    assert.equal(project.videoPackage.final_video.reason, "ffmpeg_not_available");
    assert.equal(
      project.videoPackage.video_generation.every((item) => item.generated_video?.url),
      true
    );
  });
});

test("video generation keeps partial success and retry only regenerates the failed segment", async () => {
  await withProviderEnv({
    VIDEO_API_KEY: "video-key",
    VIDEO_API_URL: "https://video.example.test/v1/videos/generations",
    VIDEO_MODEL: "seedance2.0 720p-fast"
  }, async () => {
    const project = readyProject();
    const submittedSegments = [];
    let storedVideos = 0;
    let downloadCount = 0;

    const dependencies = {
      readFileImpl: async (path) => readFileByStoredName(path),
      fetchImpl: async (_url, options) => {
        const body = JSON.parse(options.body);
        const segmentId = body.prompt.includes("ONLY 10-20s") ? "10-20s" : "0-10s";
        submittedSegments.push(segmentId);
        if (segmentId === "10-20s" && submittedSegments.filter((id) => id === "10-20s").length === 1) {
          return new Response("", {
            status: 524,
            headers: { "x-request-id": "video-timeout-524" }
          });
        }
        return new Response(JSON.stringify({
          data: [{ url: `https://cdn.example.test/${segmentId}.mp4` }]
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "x-request-id": `submit-${segmentId}` }
        });
      },
      downloadFetchImpl: async () => {
        downloadCount += 1;
        return new Response(tinyMp4Bytes, {
          status: 200,
          headers: { "Content-Type": "video/mp4" }
        });
      },
      storeGeneratedVideoImpl: async (projectId, bytes, mimeType, prefix) => {
        storedVideos += 1;
        return {
          url: `/uploads/${projectId}/${prefix}-${storedVideos}.mp4`,
          storedName: `${prefix}-${storedVideos}.mp4`,
          mimeType,
          size: bytes.length
        };
      },
      ffmpegAvailableImpl: async () => false
    };

    await generateProjectVideos(project, "2026-06-12T01:20:00.000Z", dependencies);

    assert.deepEqual([...submittedSegments].sort(), ["0-10s", "10-20s"]);
    assert.equal(downloadCount, 1);
    assert.equal(storedVideos, 1);
    assert.equal(project.videoPackage.mode, "partial");
    assert.equal(project.videoPackage.video_generation[0].status, "done");
    assert.equal(project.videoPackage.video_generation[1].status, "failed");
    assert.equal(project.videoPackage.video_generation[1].error.code, "VIDEO_PROVIDER_TIMEOUT");
    assert.equal(project.videoPackage.video_generation[1].error.retryable, true);
    assert.equal(project.videoPackage.video_generation[1].provider_diagnostics.providerStatus, 524);
    assert.equal(project.videoPackage.video_generation[1].provider_diagnostics.providerRequestId, "video-timeout-524");
    assert.equal(
      Object.prototype.hasOwnProperty.call(project.videoPackage.video_generation[1].provider_diagnostics, "prompt"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(project.videoPackage.video_generation[1].provider_diagnostics, "apiKey"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(project.videoPackage.video_generation[1].provider_diagnostics, "base64"),
      false
    );

    const successUrl = project.videoPackage.video_generation[0].generated_video.url;
    await retryProjectVideoSegment(project, "10-20s", dependencies);

    assert.deepEqual(submittedSegments, ["0-10s", "10-20s", "10-20s"]);
    assert.equal(downloadCount, 2);
    assert.equal(storedVideos, 2);
    assert.equal(project.videoPackage.video_generation[0].generated_video.url, successUrl);
    assert.equal(project.videoPackage.video_generation[1].status, "done");
    assert.equal(project.videoPackage.mode, "done");
    assert.equal(project.videoPackage.final_video.status, "unavailable");
  });
});

test("video status refresh completes queued jobs and records safe request ids", async () => {
  await withProviderEnv({
    VIDEO_API_KEY: "video-key",
    VIDEO_API_URL: "https://video.example.test/v1/videos/generations",
    VIDEO_MODEL: "seedance2.0 720p-fast"
  }, async () => {
    const project = readyProject();
    ensureVideoPackage(project, "2026-06-12T01:30:00.000Z");
    for (const item of project.videoPackage.video_generation) {
      item.status = "queued";
      item.provider_job = {
        id: `job-${item.segment_id}`,
        statusUrl: `https://video.example.test/v1/videos/${item.segment_id}`,
        submittedAt: "2026-06-12T01:30:00.000Z"
      };
      item.provider_diagnostics = {
        segmentId: item.segment_id,
        assetId: item.asset_id,
        attemptId: `attempt-${item.segment_id}`,
        startedAt: "2026-06-12T01:30:00.000Z",
        model: "seedance2.0 720p-fast",
        aspectRatio: "4:5",
        durationSec: 10,
        providerHost: "video.example.test",
        providerPath: "/v1/videos/generations",
        storyboardImageCount: 1,
        referenceImageCount: 1,
        inputImageCount: 2,
        referenceImageTotalBytes: referenceBytes.length,
        storyboardImageBytes: storyboardBytes.length,
        keyPreview: "鈥⑩€⑩€⑩€?o-key"
      };
    }

    let storedVideos = 0;
    await refreshProjectVideoStatus(project, {
      fetchImpl: async (url, options) => {
        assert.equal(options.headers.Authorization, "Bearer video-key");
        return new Response(JSON.stringify({
          status: "completed",
          url: `https://cdn.example.test/${String(url).includes("0-10s") ? "a" : "b"}.mp4`
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "x-request-id": `status-${String(url).includes("0-10s") ? "a" : "b"}` }
        });
      },
      downloadFetchImpl: async () => new Response(tinyMp4Bytes, {
        status: 200,
        headers: { "Content-Type": "video/mp4" }
      }),
      storeGeneratedVideoImpl: async (projectId, bytes, mimeType, prefix) => {
        storedVideos += 1;
        return {
          url: `/uploads/${projectId}/${prefix}-${storedVideos}.mp4`,
          storedName: `${prefix}-${storedVideos}.mp4`,
          mimeType,
          size: bytes.length
        };
      },
      ffmpegAvailableImpl: async () => false
    });

    assert.equal(storedVideos, 2);
    assert.deepEqual(
      project.videoPackage.video_generation.map((item) => item.status),
      ["done", "done"]
    );
    assert.equal(project.videoPackage.video_generation[0].provider_diagnostics.providerRequestId, "status-a");
    assert.equal(project.videoPackage.video_generation[1].provider_diagnostics.providerRequestId, "status-b");
    assert.equal(project.videoPackage.final_video.status, "unavailable");
  });
});

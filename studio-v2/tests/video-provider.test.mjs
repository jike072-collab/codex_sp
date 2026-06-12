import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVideoProviderRequest,
  generateProjectVideos,
  refreshProjectVideoStatus,
  retryProjectVideoSegment
} from "../src/ai-providers/video-provider.mjs";
import { ensureVideoPackage } from "../src/workflow-domain/video-package.mjs";

const providerEnvKeys = ["VIDEO_MODEL_API_KEY", "VIDEO_API_URL", "VIDEO_MODEL"];
const tinyMp4Bytes = Buffer.from("00000018667479706d703432000000006d7034326d703431", "hex");
const storyboardBytes = Buffer.from("storyboard-sheet");
const referenceBytes = Buffer.from("reference-shoe");

async function withProviderEnv(callback) {
  const previous = Object.fromEntries(providerEnvKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    VIDEO_MODEL_API_KEY: "video-key",
    VIDEO_API_URL: "https://video.example.test/v1/videos/generations",
    VIDEO_MODEL: "seedance2.0 720p-fast"
  });
  try {
    return await callback();
  } finally {
    for (const key of providerEnvKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function shot(start_sec, end_sec, label) {
  return {
    start_sec,
    end_sec,
    visual: `${label} visual`,
    action: `${label} action`,
    camera: `${label} camera`,
    selling_point: `${label} point`,
    localized_caption_or_vo: `${label} caption`,
    sound: `${label} sound`,
    transition: `${label} cut`
  };
}

function storyboard(segment_id, duration_sec) {
  return {
    asset_id: `${segment_id}_storyboard_board`,
    segment_id,
    type: "storyboard_board",
    aspect_ratio: "4:5",
    duration_sec,
    prompt: segment_id,
    negative_prompt: "none",
    reference_policy: "img2img-only",
    status: "done",
    script_copy: `${segment_id} script copy`,
    generated_image: {
      provider: "Right Code",
      model: "gpt-image-2",
      url: `/uploads/video-project/storyboard-${segment_id}.png`,
      size: "1536x1024",
      storedName: `storyboard-${segment_id}.png`,
      mimeType: "image/png"
    }
  };
}

function readyProject(workflowMode = "single_video") {
  const single = workflowMode === "single_video";
  const project = {
    id: "video-project",
    name: "Video project",
    workflowMode,
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
      outputAspectRatio: "4:5",
      videoDurationSeconds: 12
    },
    planningPackage: {
      mode: "confirmed",
      workflow_mode: workflowMode,
      product_lock_manifest: {},
      localized_copy: {}
    },
    imagePackage: {
      mode: "api",
      storyboard_plan: {},
      qc_checklist: [],
      image_generation: single
        ? [storyboard("full", 12)]
        : [storyboard("0-10s", 10), storyboard("10-20s", 10)]
    },
    videoPackage: null,
    manualOmniPackages: [],
    visualGeneratedAt: "2026-06-12T00:20:00.000Z",
    visualGenerationFailure: null
  };
  if (single) {
    project.planningPackage.script_video = {
      total_duration_sec: 12,
      segment_full: {
        segment_id: "full",
        theme: "Full",
        duration_sec: 12,
        shots: [shot(0, 12, "full")]
      }
    };
  } else {
    project.planningPackage.script_20s = {
      total_duration_sec: 20,
      segment_a_0_10s: {
        segment_id: "0-10s",
        theme: "Opening",
        duration_sec: 10,
        shots: [shot(0, 10, "opening")]
      },
      segment_b_10_20s: {
        segment_id: "10-20s",
        theme: "Closing",
        duration_sec: 10,
        shots: [shot(10, 20, "closing")]
      }
    };
  }
  return project;
}

function dependencies(fetchImpl, counters = {}) {
  return {
    fetchImpl,
    readFileImpl: async (path) => (
      String(path).includes("shoe-collage.png") ? referenceBytes : storyboardBytes
    ),
    downloadFetchImpl: async () => new Response(tinyMp4Bytes, {
      status: 200,
      headers: { "Content-Type": "video/mp4" }
    }),
    storeGeneratedVideoImpl: async (projectId, bytes, mimeType, prefix) => {
      counters.stored = (counters.stored || 0) + 1;
      return {
        url: `/uploads/${projectId}/${prefix}-${counters.stored}.mp4`,
        storedName: `${prefix}-${counters.stored}.mp4`,
        mimeType,
        size: bytes.length
      };
    },
    ffmpegAvailableImpl: async () => false
  };
}

test("single mode builds one full video request with selected duration", () => {
  const project = readyProject("single_video");
  const item = ensureVideoPackage(project).video_generation[0];
  const request = buildVideoProviderRequest(
    project,
    "full",
    item,
    { VIDEO_MODEL: "seedance2.0 720p-fast" },
    { dataUrl: "data:image/png;base64,AAAA", byteLength: storyboardBytes.length },
    [{ dataUrl: "data:image/png;base64,BBBB", byteLength: referenceBytes.length }]
  );

  assert.equal(project.videoPackage.video_generation.length, 1);
  assert.equal(request.duration, 12);
  assert.match(request.prompt, /full 0-12s timeline/);
});

test("dual 20-second mode keeps two video tasks", () => {
  const project = readyProject("legacy_multi_segment");
  const videoPackage = ensureVideoPackage(project);
  assert.deepEqual(
    videoPackage.video_generation.map((item) => item.segment_id),
    ["0-10s", "10-20s"]
  );
  assert.deepEqual(
    videoPackage.video_generation.map((item) => item.duration_sec),
    [10, 10]
  );
});

test("single mode submits exactly one video provider request", async () => {
  await withProviderEnv(async () => {
    const project = readyProject("single_video");
    let requests = 0;
    await generateProjectVideos(project, undefined, dependencies(async (_url, options) => {
      requests += 1;
      assert.equal(JSON.parse(options.body).duration, 12);
      return new Response(JSON.stringify({
        data: [{ url: "https://cdn.example.test/full.mp4" }]
      }), { status: 200 });
    }));

    assert.equal(requests, 1);
    assert.equal(project.videoPackage.video_generation[0].status, "done");
  });
});

test("dual mode keeps partial success and retry only resubmits the failed segment", async () => {
  await withProviderEnv(async () => {
    const project = readyProject("legacy_multi_segment");
    const submitted = [];
    const counters = {};
    const deps = dependencies(async (_url, options) => {
      const prompt = JSON.parse(options.body).prompt;
      const segmentId = prompt.includes("10-20s") ? "10-20s" : "0-10s";
      submitted.push(segmentId);
      if (segmentId === "10-20s" && submitted.filter((id) => id === segmentId).length === 1) {
        return new Response("", { status: 524 });
      }
      return new Response(JSON.stringify({
        data: [{ url: `https://cdn.example.test/${segmentId}.mp4` }]
      }), { status: 200 });
    }, counters);

    await generateProjectVideos(project, undefined, deps);
    assert.deepEqual([...submitted].sort(), ["0-10s", "10-20s"]);
    assert.equal(project.videoPackage.mode, "partial");
    const successUrl = project.videoPackage.video_generation[0].generated_video.url;

    await retryProjectVideoSegment(project, "10-20s", deps);
    assert.deepEqual(submitted, ["0-10s", "10-20s", "10-20s"]);
    assert.equal(project.videoPackage.video_generation[0].generated_video.url, successUrl);
    assert.equal(project.videoPackage.mode, "done");
  });
});

test("video status refresh completes queued tasks without exposing request content", async () => {
  await withProviderEnv(async () => {
    const project = readyProject("single_video");
    const item = ensureVideoPackage(project).video_generation[0];
    item.status = "queued";
    item.provider_job = {
      id: "job-full",
      statusUrl: "https://video.example.test/v1/videos/full",
      submittedAt: "2026-06-12T01:30:00.000Z"
    };
    item.provider_diagnostics = {
      segmentId: "full",
      assetId: item.asset_id,
      attemptId: "attempt-full",
      startedAt: "2026-06-12T01:30:00.000Z"
    };

    await refreshProjectVideoStatus(project, dependencies(async () => new Response(JSON.stringify({
      status: "completed",
      url: "https://cdn.example.test/full.mp4"
    }), {
      status: 200,
      headers: { "x-request-id": "status-full" }
    })));

    const refreshed = project.videoPackage.video_generation[0];
    assert.equal(refreshed.status, "done");
    assert.equal(refreshed.provider_diagnostics.providerRequestId, "status-full");
    assert.equal(Object.hasOwn(refreshed.provider_diagnostics, "prompt"), false);
  });
});

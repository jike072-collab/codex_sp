import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { analyzeProject } from "../src/ai-providers/vision-provider.mjs";
import { generateProjectScript } from "../src/ai-providers/text-provider.mjs";
import { generateProjectVisuals } from "../src/ai-providers/image-provider.mjs";
import {
  postProviderFormData,
  postProviderJson
} from "../src/ai-providers/provider-utils.mjs";
import {
  generateDemoPlanningPackage,
  generateProjectDemoScript
} from "../src/workflow-domain/demo-script.mjs";
import { confirmPlanningPackage } from "../src/workflow-domain/script-review.mjs";

const providerEnvKeys = [
  "VISION_MODEL_API_KEY",
  "VISION_API_URL",
  "VISION_MODEL",
  "TEXT_MODEL_API_KEY",
  "TEXT_API_URL",
  "TEXT_MODEL",
  "IMAGE_MODEL_API_KEY",
  "IMAGE_API_URL",
  "IMAGE_MODEL",
  "IMAGE_SECONDARY_API_KEY",
  "IMAGE_SECONDARY_API_URL",
  "IMAGE_SECONDARY_MODEL",
  "IMAGE_MODEL_PROVIDER"
];

const tinyPngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

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
  const previous = Object.fromEntries(
    providerEnvKeys.map((key) => [key, process.env[key]])
  );
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

function reviewedProject() {
  return {
    id: "provider-project",
    name: "Provider project",
    status: "script",
    targetCountry: "Thailand",
    audience: "Daily commuters",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    assets: [],
    reviewConfirmedAt: "2026-06-06T00:10:00.000Z",
    marketConfirmedAt: "2026-06-06T00:20:00.000Z",
    marketBrief: {
      targetCountry: "Thailand",
      audience: "Daily commuters",
      creativeTheme: "city-motion",
      coreMessage: "Light and stable for every day",
      tone: "energetic"
    },
    visionAnalysis: {
      product_summary: {
        shoe_type: "running shoe",
        likely_usage: { value: "daily movement", evidence: "inferred" },
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
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      },
      visible_selling_point_candidates: []
    }
  };
}

function dualImageEnv(overrides = {}) {
  return {
    IMAGE_MODEL_API_KEY: "test-codesonline-key-1111",
    IMAGE_API_URL: "https://image-a.example.test/v1/images/edits",
    IMAGE_MODEL: "img2",
    IMAGE_SECONDARY_API_KEY: "test-codesonline-key-2222",
    IMAGE_SECONDARY_API_URL: "https://image-b.example.test/v1/images/edits",
    IMAGE_SECONDARY_MODEL: "img2",
    IMAGE_MODEL_PROVIDER: "codesonline",
    ...overrides
  };
}

async function inspectImageFormRequest(url, options) {
  assert.equal(options.body instanceof FormData, true);
  assert.equal(options.headers["Content-Type"], undefined);
  assert.equal(options.headers["content-type"], undefined);
  const form = options.body;
  const references = [form.get("image"), ...form.getAll("image[]")];
  return {
    url,
    authorization: options.headers.Authorization,
    body: {
      model: form.get("model"),
      prompt: form.get("prompt"),
      n: form.get("n"),
      size: form.get("size"),
      quality: form.get("quality"),
      upscale: form.get("upscale"),
      response_format: form.get("response_format"),
      primaryReferenceCount: form.getAll("image").length,
      additionalReferenceCount: form.getAll("image[]").length,
      references: await Promise.all(references.map(async (reference) => ({
        name: reference.name,
        type: reference.type,
        bytes: Buffer.from(await reference.arrayBuffer())
      })))
    }
  };
}

test("Right Code vision adapter uses the native Gemini channel", async () => {
  await withProviderEnv({
    VISION_MODEL_API_KEY: "test-right-code-key",
    VISION_API_URL: "https://right.codes/gemini",
    VISION_MODEL: "gemini-2.5-flash"
  }, async () => {
    let requestBody;
    const analysis = await analyzeProject(
      { id: "vision-project", assets: [] },
      {
        fetchImpl: async (url, options) => {
          assert.equal(
            url,
            "https://right.codes/gemini/v1beta/models/gemini-2.5-flash:generateContent"
          );
          assert.equal(options.headers["x-goog-api-key"], "test-right-code-key");
          assert.equal("Authorization" in options.headers, false);
          requestBody = JSON.parse(options.body);
          return new Response(JSON.stringify({
            candidates: [{
              content: {
                parts: [
                  { thought: true, text: "Internal reasoning that is not JSON." },
                  { text: JSON.stringify(reviewedProject().visionAnalysis) }
                ]
              }
            }]
          }), { status: 200 });
        }
      }
    );

    assert.equal(requestBody.contents[0].parts[0].text.includes("同一款鞋"), true);
    assert.equal(requestBody.generationConfig.responseMimeType, "application/json");
    assert.equal(analysis.mode, "api");
    assert.deepEqual(analysis.product_lock_manifest.must_keep, ["exact silhouette"]);
  });
});

test("Right Code vision adapter keeps legacy Draw channel compatibility", async () => {
  await withProviderEnv({
    VISION_MODEL_API_KEY: "test-right-code-key",
    VISION_API_URL: "https://example.test/draw/v1/chat/completions",
    VISION_MODEL: "gemini-2.5-flash"
  }, async () => {
    let requestBody;
    const analysis = await analyzeProject(
      { id: "vision-project", assets: [] },
      {
        fetchImpl: async (url, options) => {
          assert.equal(url, "https://example.test/draw/v1/chat/completions");
          assert.equal(options.headers.Authorization, "Bearer test-right-code-key");
          assert.equal(options.headers["Content-Type"], "application/json");
          requestBody = JSON.parse(options.body);
          return new Response(JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify(reviewedProject().visionAnalysis)
              }
            }]
          }), { status: 200 });
        }
      }
    );

    assert.equal(requestBody.model, "gemini-2.5-flash");
    assert.equal(requestBody.stream, false);
    assert.equal(requestBody.messages[1].content[0].type, "text");
    assert.equal(analysis.mode, "api");
    assert.deepEqual(
      analysis.product_lock_manifest.must_keep,
      ["exact silhouette"]
    );
  });
});

test("vision adapter supports Sub2API OpenAI-compatible image messages", async () => {
  await withProviderEnv({
    VISION_MODEL_API_KEY: "test-sub2api-key",
    VISION_API_URL: "http://127.0.0.1:8080/v1/chat/completions",
    VISION_MODEL: "gemini-2.5-flash"
  }, async () => {
    let requestBody;
    const analysis = await analyzeProject(
      { id: "vision-project", assets: [] },
      {
        fetchImpl: async (url, options) => {
          assert.equal(url, "http://127.0.0.1:8080/v1/chat/completions");
          assert.equal(options.headers.Authorization, "Bearer test-sub2api-key");
          assert.equal(options.headers["Content-Type"], "application/json");
          requestBody = JSON.parse(options.body);
          return new Response(JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify(reviewedProject().visionAnalysis)
              }
            }]
          }), { status: 200 });
        }
      }
    );

    assert.equal(requestBody.model, "gemini-2.5-flash");
    assert.equal(requestBody.messages[1].content[0].type, "text");
    assert.equal(analysis.mode, "api");
  });
});

test("provider HTTP 524 is classified as a possibly billed timeout", async () => {
  await assert.rejects(
    postProviderJson({
      url: "https://example.test/images",
      apiKey: "test-key",
      body: { prompt: "storyboard" },
      timeoutMs: 1000,
      providerLabel: "Right Code 图片模型",
      errorCode: "IMAGE_PROVIDER_ERROR",
      fetchImpl: async () => new Response("", { status: 524 })
    }),
    (error) => {
      assert.equal(error.code, "IMAGE_PROVIDER_TIMEOUT");
      assert.equal(error.providerStatus, 524);
      assert.equal(error.possiblyBilled, true);
      return true;
    }
  );
});

test("multipart provider requests let fetch add the boundary content type", async () => {
  let receivedContentType = "";
  let receivedBody = "";
  const server = http.createServer((request, response) => {
    receivedContentType = request.headers["content-type"] || "";
    request.setEncoding("latin1");
    request.on("data", (chunk) => {
      receivedBody += chunk;
    });
    request.on("end", () => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ data: [{ url: "https://images.test/one.png" }] }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("prompt", "safe test prompt");
    form.append("image", new Blob([Buffer.from("reference")], { type: "image/png" }), "shoe.png");
    await postProviderFormData({
      url: `http://127.0.0.1:${address.port}/v1/images/edits`,
      apiKey: "test-key",
      body: form,
      timeoutMs: 1000,
      providerLabel: "图片生成供应商",
      errorCode: "IMAGE_PROVIDER_ERROR"
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  assert.match(receivedContentType, /^multipart\/form-data;\s*boundary=/i);
  assert.match(receivedBody, /name="image"; filename="shoe\.png"/);
  assert.doesNotMatch(receivedContentType, /application\/json/i);
});

test("provider excessive system load is classified as retryable overload", async () => {
  await assert.rejects(
    postProviderJson({
      url: "https://example.test/images",
      apiKey: "test-key",
      body: { prompt: "storyboard" },
      timeoutMs: 1000,
      providerLabel: "Right Code image model",
      errorCode: "IMAGE_PROVIDER_ERROR",
      fetchImpl: async () => new Response(JSON.stringify({
        error: { message: "excessive system load" }
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }),
    (error) => {
      assert.equal(error.code, "IMAGE_PROVIDER_OVERLOADED");
      assert.equal(error.providerStatus, 400);
      assert.equal(error.retryable, true);
      assert.equal(error.possiblyBilled, false);
      assert.match(error.message, /excessive system load/);
      return true;
    }
  );
});

test("provider errors preserve string error details", async () => {
  await assert.rejects(
    () => postProviderJson({
      url: "https://example.test/v1/chat/completions",
      apiKey: "test-key",
      body: {},
      timeoutMs: 1000,
      providerLabel: "Right Code 识图模型",
      errorCode: "VISION_PROVIDER_ERROR",
      fetchImpl: async () => new Response(JSON.stringify({
        error: "API Key 不允许使用该模型"
      }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      })
    }),
    (error) => {
      assert.equal(error.code, "VISION_PROVIDER_ERROR");
      assert.equal(error.providerStatus, 403);
      assert.match(error.message, /API Key 不允许使用该模型/);
      return true;
    }
  );
});

test("script adapter requests single-video JSON without forcing the 20-second dual shape", async () => {
  await withProviderEnv({
    TEXT_MODEL_API_KEY: "test-script-key",
    TEXT_API_URL: "https://script.example.test/chat/completions",
    TEXT_MODEL: "gemini-2.5-pro"
  }, async () => {
    const project = reviewedProject();
    project.workflowMode = "single_video";
    project.marketBrief.videoDurationSeconds = 10;
    const confirmedLock = structuredClone(project.visionAnalysis.product_lock_manifest);
    const modelOutput = generateDemoPlanningPackage(structuredClone(project));
    modelOutput.product_lock_manifest.must_keep = [];
    modelOutput.product_lock_manifest.must_not_change = [];
    let requestBody;
    await generateProjectScript(project, "2026-06-06T01:00:00.000Z", {
      fetchImpl: async (url, options) => {
        assert.equal(url, "https://script.example.test/chat/completions");
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify(modelOutput) } }]
        }), { status: 200 });
      }
    });

    assert.equal(requestBody.model, "gemini-2.5-pro");
    assert.match(requestBody.messages[0].content, /script_video/);
    assert.match(requestBody.messages[0].content, /segment_full/);
    assert.doesNotMatch(requestBody.messages[0].content, /视频总时长固定 20 秒/);
    const userPayload = JSON.parse(requestBody.messages[1].content);
    assert.equal(userPayload.workflow_mode, "single_video");
    assert.equal(userPayload.total_duration_seconds, 10);
    assert.equal(userPayload.requested_shot_count, 5);
    assert.equal(userPayload.required_top_level_keys.includes("script_video"), true);
    assert.deepEqual(userPayload.forbidden_top_level_keys, ["script_20s"]);
    assert.deepEqual(userPayload.confirmed_product_lock_manifest, confirmedLock);
    assert.deepEqual(
      userPayload.output_schema.product_lock_manifest.must_keep,
      confirmedLock.must_keep
    );
    assert.deepEqual(
      userPayload.output_schema.product_lock_manifest.must_not_change,
      confirmedLock.must_not_change
    );
    assert.equal(userPayload.output_schema.script_video.segment_full.segment_id, "full");
    assert.equal(userPayload.output_schema.script_20s, undefined);
    assert.deepEqual(requestBody.response_format, { type: "json_object" });
    assert.deepEqual(requestBody.thinking, { type: "enabled" });
    assert.equal(project.planningPackage.mode, "api");
    assert.equal(project.planningPackage.workflow_mode, "single_video");
    assert.deepEqual(project.planningPackage.product_lock_manifest, confirmedLock);
    assert.equal(project.planningPackage.script_video.total_duration_sec, 10);
    assert.equal(project.scriptGeneratedAt, "2026-06-06T01:00:00.000Z");
  });
});

test("script adapter rejects dual-script output in single-video mode with neutral wording", async () => {
  await withProviderEnv({
    TEXT_MODEL_API_KEY: "test-script-key",
    TEXT_API_URL: "https://script.example.test/chat/completions",
    TEXT_MODEL: "gemini-2.5-pro"
  }, async () => {
    const project = reviewedProject();
    project.workflowMode = "single_video";
    project.marketBrief.videoDurationSeconds = 10;
    const legacyOutput = generateDemoPlanningPackage(structuredClone(reviewedProject()));

    await assert.rejects(
      generateProjectScript(project, "2026-06-06T01:00:00.000Z", {
        fetchImpl: async () => new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify(legacyOutput) } }]
        }), { status: 200 })
      }),
      (error) => {
        assert.equal(error.code, "TEXT_PROVIDER_INVALID_OUTPUT");
        assert.match(error.message, /脚本模型/);
        assert.doesNotMatch(error.message, /DeepSeek/);
        return true;
      }
    );
  });
});

test("script adapter keeps the dual-segment schema for 20-second mode", async () => {
  await withProviderEnv({
    TEXT_MODEL_API_KEY: "test-script-key",
    TEXT_API_URL: "https://script.example.test/chat/completions",
    TEXT_MODEL: "gemini-2.5-pro"
  }, async () => {
    const project = reviewedProject();
    project.workflowMode = "legacy_multi_segment";
    const modelOutput = generateDemoPlanningPackage(structuredClone(project));
    let requestBody;
    await generateProjectScript(project, "2026-06-06T01:00:00.000Z", {
      fetchImpl: async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify(modelOutput) } }]
        }), { status: 200 });
      }
    });

    assert.match(requestBody.messages[0].content, /script_20s/);
    assert.doesNotMatch(requestBody.messages[0].content, /script_video\.segment_full covering/);
    const userPayload = JSON.parse(requestBody.messages[1].content);
    assert.equal(userPayload.workflow_mode, "legacy_multi_segment");
    assert.equal(userPayload.required_top_level_keys.includes("script_20s"), true);
    assert.deepEqual(userPayload.forbidden_top_level_keys, ["script_video"]);
    assert.equal(userPayload.output_schema.script_20s.total_duration_sec, 20);
    assert.equal(userPayload.output_schema.script_video, undefined);
    assert.equal(project.planningPackage.workflow_mode, "legacy_multi_segment");
    assert.equal(project.planningPackage.script_20s.total_duration_sec, 20);
  });
});

test("script adapter rejects single-video output in dual-segment mode", async () => {
  await withProviderEnv({
    TEXT_MODEL_API_KEY: "test-script-key",
    TEXT_API_URL: "https://script.example.test/chat/completions",
    TEXT_MODEL: "gemini-2.5-pro"
  }, async () => {
    const project = reviewedProject();
    project.workflowMode = "legacy_multi_segment";
    const singleProject = reviewedProject();
    singleProject.workflowMode = "single_video";
    singleProject.marketBrief.videoDurationSeconds = 10;
    const singleOutput = generateDemoPlanningPackage(structuredClone(singleProject));

    await assert.rejects(
      generateProjectScript(project, "2026-06-06T01:00:00.000Z", {
        fetchImpl: async () => new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify(singleOutput) } }]
        }), { status: 200 })
      }),
      (error) => {
        assert.equal(error.code, "TEXT_PROVIDER_INVALID_OUTPUT");
        assert.match(error.message, /脚本模型/);
        assert.doesNotMatch(error.message, /DeepSeek/);
        return true;
      }
    );
  });
});

test("CodesOnline image adapter sends two concurrent multipart storyboard requests", async () => {
  await withProviderEnv(dualImageEnv(), async () => {
    const project = reviewedProject();
    project.marketBrief.outputAspectRatio = "4:5";
    project.assets = [
      { name: "../Shoe Front.PNG", storedName: "shoe-front.png", mimeType: "image/png" },
      { name: "side shot.jpeg", storedName: "shoe-side.jpg", mimeType: "image/jpeg" },
      { name: "heel.webp", storedName: "shoe-heel.webp", mimeType: "image/webp" }
    ];
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z");
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );

    const requests = [];
    let storedImages = 0;
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const referenceBytes = new Map([
      ["shoe-front.png", Buffer.from("synthetic-png-reference")],
      ["shoe-side.jpg", Buffer.from("synthetic-jpeg-reference")],
      ["shoe-heel.webp", Buffer.from("synthetic-webp-reference")]
    ]);
    await generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", {
      uploadsRootPath: "C:\\synthetic-uploads",
      readFileImpl: async (path) => {
        const storedName = path.split(/[\\/]/).at(-1);
        assert.equal(referenceBytes.has(storedName), true);
        return referenceBytes.get(storedName);
      },
      fetchImpl: async (url, options) => {
        requests.push(await inspectImageFormRequest(url, options));
        const requestNumber = requests.length;
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeRequests -= 1;
        return new Response(JSON.stringify({
          data: [{ url: `https://images.test/${requestNumber}.png` }]
        }), { status: 200 });
      },
      downloadFetchImpl: async () => new Response(tinyPngBytes, {
        status: 200,
        headers: { "Content-Type": "image/png" }
      }),
      storeGeneratedImageImpl: async (projectId, bytes, mimeType) => ({
        url: `/uploads/${projectId}/storyboard-${++storedImages}.png`,
        storedName: `storyboard-${storedImages}.png`,
        mimeType,
        size: bytes.length
      })
    });

    assert.equal(requests.length, 2);
    assert.equal(maxActiveRequests, 2);
    const firstSegmentRequest = requests.find((request) => /ONLY the 0-10s shoe ad segment/.test(request.body.prompt));
    const secondSegmentRequest = requests.find((request) => /ONLY the 10-20s shoe ad segment/.test(request.body.prompt));
    assert.ok(firstSegmentRequest);
    assert.ok(secondSegmentRequest);
    assert.equal(firstSegmentRequest.url, "https://image-a.example.test/v1/images/edits");
    assert.equal(secondSegmentRequest.url, "https://image-b.example.test/v1/images/edits");
    assert.equal(firstSegmentRequest.authorization, "Bearer test-codesonline-key-1111");
    assert.equal(secondSegmentRequest.authorization, "Bearer test-codesonline-key-2222");
    assert.equal(firstSegmentRequest.body.model, "gpt-image-2");
    assert.equal(secondSegmentRequest.body.model, "gpt-image-2");
    assert.equal(firstSegmentRequest.body.upscale, null);
    assert.equal(secondSegmentRequest.body.upscale, null);
    assert.equal(typeof firstSegmentRequest.body.prompt, "string");
    assert.deepEqual(
      firstSegmentRequest.body.references.map(({ name, type }) => ({ name, type })),
      [
        { name: "Shoe-Front.png", type: "image/png" },
        { name: "side-shot.jpg", type: "image/jpeg" },
        { name: "heel.webp", type: "image/webp" }
      ]
    );
    assert.deepEqual(
      firstSegmentRequest.body.references.map(({ bytes }) => bytes),
      [...referenceBytes.values()]
    );
    assert.equal(firstSegmentRequest.body.primaryReferenceCount, 1);
    assert.equal(firstSegmentRequest.body.additionalReferenceCount, 2);
    assert.equal(firstSegmentRequest.body.n, "1");
    assert.equal(secondSegmentRequest.body.n, "1");
    assert.equal(firstSegmentRequest.body.size, "1536x1024");
    assert.equal(secondSegmentRequest.body.size, "1536x1024");
    assert.equal(firstSegmentRequest.body.quality, "high");
    assert.match(firstSegmentRequest.body.prompt, /internal shot thumbnail\/panel must be composed as a 4:5 video frame/);
    assert.doesNotMatch(firstSegmentRequest.body.prompt, /Create one 4:5 commercial storyboard board/);
    assert.equal(firstSegmentRequest.body.response_format, "url");
    assert.equal(project.imagePackage.mode, "api");
    assert.deepEqual(
      project.imagePackage.image_generation.map((item) => item.provider_diagnostics.drawChannelId),
      ["primary", "secondary"]
    );
    assert.deepEqual(
      project.imagePackage.image_generation.map((item) => item.provider_diagnostics.keyPreview),
      ["•••• 1111", "•••• 2222"]
    );
  });
});

test("CodesOnline image tiers add only their matching upscale form field", async () => {
  await withProviderEnv(dualImageEnv({
    IMAGE_MODEL: "img2-2k",
    IMAGE_SECONDARY_MODEL: "img2-4k"
  }), async () => {
    const project = reviewedProject();
    project.assets = [{ storedName: "shoe.png", mimeType: "image/png" }];
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z");
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );

    const requests = [];
    await generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", {
      readFileImpl: async () => Buffer.from("synthetic-shoe-reference"),
      fetchImpl: async (url, options) => {
        requests.push(await inspectImageFormRequest(url, options));
        return new Response(JSON.stringify({
          data: [{ b64_json: tinyPngBytes.toString("base64") }]
        }), { status: 200 });
      },
      storeGeneratedImageImpl: async (projectId, bytes, mimeType) => ({
        url: `/uploads/${projectId}/tier-${requests.length}.png`,
        storedName: `tier-${requests.length}.png`,
        mimeType,
        size: bytes.length
      })
    });

    const primary = requests.find((request) => request.authorization === "Bearer test-codesonline-key-1111");
    const secondary = requests.find((request) => request.authorization === "Bearer test-codesonline-key-2222");
    assert.equal(primary.body.model, "gpt-image-2");
    assert.equal(primary.body.upscale, "2k");
    assert.equal(secondary.body.model, "gpt-image-2");
    assert.equal(secondary.body.upscale, "4k");
  });
});

test("single-video CodesOnline generation uses channel A once and ignores extra data results", async () => {
  await withProviderEnv(dualImageEnv({ IMAGE_MODEL: "gpt-image-2" }), async () => {
    const project = reviewedProject();
    project.workflowMode = "single_video";
    project.marketBrief.videoDurationSeconds = 10;
    project.assets = [{ name: "shoe.png", storedName: "shoe.png", mimeType: "image/png" }];
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z");
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );

    const providerRequests = [];
    const downloadedUrls = [];
    await generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", {
      readFileImpl: async () => Buffer.from("synthetic-shoe-reference"),
      fetchImpl: async (url, options) => {
        providerRequests.push(await inspectImageFormRequest(url, options));
        return new Response(JSON.stringify({
          data: [
            { url: "https://images.test/full-first.png" },
            { url: "https://images.test/must-be-ignored.png" }
          ]
        }), { status: 200 });
      },
      downloadFetchImpl: async (url) => {
        downloadedUrls.push(url);
        return new Response(tinyPngBytes, {
          status: 200,
          headers: { "Content-Type": "image/png" }
        });
      },
      storeGeneratedImageImpl: async (projectId, bytes, mimeType) => ({
        url: `/uploads/${projectId}/full.png`,
        storedName: "full.png",
        mimeType,
        size: bytes.length
      })
    });

    assert.equal(providerRequests.length, 1);
    assert.equal(providerRequests[0].url, "https://image-a.example.test/v1/images/edits");
    assert.equal(providerRequests[0].authorization, "Bearer test-codesonline-key-1111");
    assert.equal(providerRequests[0].body.model, "gpt-image-2");
    assert.equal(providerRequests[0].body.upscale, null);
    assert.equal(providerRequests[0].body.n, "1");
    assert.deepEqual(downloadedUrls, ["https://images.test/full-first.png"]);
    assert.equal(project.imagePackage.image_generation.length, 1);
    assert.equal(project.imagePackage.image_generation[0].segment_id, "full");
    assert.equal(project.imagePackage.image_generation[0].generated_image.provider, "codesonline");
  });
});

test("legacy image profiles keep their existing JSON transport", async () => {
  await withProviderEnv(dualImageEnv({
    IMAGE_API_URL: "https://legacy-image.example.test/v1/images/generations"
  }), async () => {
    const project = reviewedProject();
    project.workflowMode = "single_video";
    project.marketBrief.videoDurationSeconds = 10;
    project.assets = [{ name: "shoe.png", storedName: "shoe.png", mimeType: "image/png" }];
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z");
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );

    await generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", {
      readFileImpl: async () => Buffer.from("legacy-reference"),
      fetchImpl: async (url, options) => {
        assert.equal(url, "https://legacy-image.example.test/v1/images/generations");
        assert.equal(options.headers["Content-Type"], "application/json");
        const body = JSON.parse(options.body);
        assert.deepEqual(body.image, [Buffer.from("legacy-reference").toString("base64")]);
        return new Response(JSON.stringify({
          data: [{ b64_json: tinyPngBytes.toString("base64") }]
        }), { status: 200 });
      },
      storeGeneratedImageImpl: async (projectId, bytes, mimeType) => ({
        url: `/uploads/${projectId}/legacy.png`,
        storedName: "legacy.png",
        mimeType,
        size: bytes.length
      })
    });

    assert.equal(
      project.imagePackage.image_generation[0].generated_image.provider,
      "image_provider"
    );
  });
});

test("CodesOnline image adapter starts both missing storyboard requests before either response resolves", async () => {
  await withProviderEnv(dualImageEnv(), async () => {
    const project = reviewedProject();
    project.assets = [{ storedName: "shoe.png", mimeType: "image/png" }];
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z");
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );

    const requests = [];
    const releases = [];
    const bothRequestsArrived = deferred();
    let releasedResponses = 0;
    let storedImages = 0;

    const generationPromise = generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", {
      uploadsRootPath: "C:\\synthetic-uploads",
      readFileImpl: async () => Buffer.from("synthetic-shoe-reference"),
      fetchImpl: async (url, options) => {
        const request = await inspectImageFormRequest(url, options);
        assert.equal(request.body.references.length, 1);
        requests.push(request);
        const release = deferred();
        releases.push(release);
        if (requests.length === 2) {
          bothRequestsArrived.resolve();
        }
        await release.promise;
        releasedResponses += 1;
        return new Response(JSON.stringify({
          data: [{ b64_json: tinyPngBytes.toString("base64") }]
        }), { status: 200 });
      },
      storeGeneratedImageImpl: async (projectId, bytes, mimeType) => {
        storedImages += 1;
        return {
          url: `/uploads/${projectId}/concurrent-${storedImages}.png`,
          storedName: `concurrent-${storedImages}.png`,
          mimeType,
          size: bytes.length
        };
      }
    });

    await withTimeout(
      bothRequestsArrived.promise,
      "Timed out waiting for both storyboard provider requests to overlap."
    );

    assert.equal(requests.length, 2);
    assert.equal(releases.length, 2);
    assert.equal(releasedResponses, 0);
    assert.equal(storedImages, 0);
    assert.notEqual(
      requests[0].body.prompt,
      requests[1].body.prompt,
      "Each concurrent request should still target its own storyboard segment."
    );
    assert.deepEqual(
      [...new Set(requests.map((request) => request.authorization))].sort(),
      ["Bearer test-codesonline-key-1111", "Bearer test-codesonline-key-2222"]
    );
    assert.deepEqual(
      [...new Set(requests.map((request) => request.url))].sort(),
      [
        "https://image-a.example.test/v1/images/edits",
        "https://image-b.example.test/v1/images/edits"
      ]
    );

    releases[0].resolve();
    releases[1].resolve();
    await generationPromise;

    assert.equal(releasedResponses, 2);
    assert.equal(storedImages, 2);
    assert.equal(project.imagePackage.mode, "api");
  });
});

test("CodesOnline image adapter does not fall back when references are forbidden", async () => {
  await withProviderEnv(dualImageEnv(), async () => {
    const project = reviewedProject();
    project.assets = [{ storedName: "shoe.png", mimeType: "image/png" }];
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z");
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );

    const requests = [];
    await assert.rejects(
      generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", {
        uploadsRootPath: "C:\\synthetic-uploads",
        readFileImpl: async () => Buffer.from("synthetic-shoe-reference"),
        fetchImpl: async (_url, options) => {
          const request = await inspectImageFormRequest(_url, options);
          requests.push(request);
          assert.equal(request.body.references.length, 1);
          return new Response(JSON.stringify({
            error: "API Key 不允许访问该渠道，请前往令牌管理界面修改令牌权限"
          }), { status: 403 });
        }
      }),
      (error) => {
        assert.equal(error.code, "IMAGE_PROVIDER_ERROR");
        assert.equal(error.providerStatus, 403);
        assert.doesNotMatch(error.message, /令牌权限/);
        return true;
      }
    );

    assert.equal(requests.length, 2);
    assert.equal(project.imagePackage.image_generation[0].generated_image, undefined);
    assert.equal(project.imagePackage.image_generation[1].generated_image, undefined);
    assert.doesNotMatch(project.imagePackage.image_generation[0].error.message, /令牌权限/);
  });
});

test("CodesOnline image adapter stores base64 image responses locally", async () => {
  await withProviderEnv(dualImageEnv(), async () => {
    const project = reviewedProject();
    project.assets = [{ storedName: "shoe.png", mimeType: "image/png" }];
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z");
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );

    let storedImages = 0;
    await generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", {
      fetchImpl: async () => new Response(JSON.stringify({
        data: [{ b64_json: tinyPngBytes.toString("base64") }]
      }), { status: 200 }),
      readFileImpl: async () => Buffer.from("synthetic-shoe-reference"),
      downloadFetchImpl: async () => {
        throw new Error("base64 responses must not be downloaded");
      },
      storeGeneratedImageImpl: async (projectId, bytes, mimeType) => {
        assert.deepEqual(bytes, tinyPngBytes);
        assert.equal(mimeType, "image/png");
        storedImages += 1;
        return {
          url: `/uploads/${projectId}/base64-${storedImages}.png`,
          storedName: `base64-${storedImages}.png`,
          mimeType,
          size: bytes.length
        };
      }
    });

    assert.equal(storedImages, 2);
    assert.equal(
      project.imagePackage.image_generation[0].generated_image.url,
      "/uploads/provider-project/base64-1.png"
    );
  });
});

test("CodesOnline URL download failures preserve the explicit failure contract", async () => {
  await withProviderEnv(dualImageEnv(), async () => {
    const project = reviewedProject();
    project.workflowMode = "single_video";
    project.marketBrief.videoDurationSeconds = 10;
    project.assets = [{ storedName: "shoe.png", mimeType: "image/png" }];
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z");
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );

    await assert.rejects(
      generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", {
        readFileImpl: async () => Buffer.from("synthetic-shoe-reference"),
        fetchImpl: async () => new Response(JSON.stringify({
          data: [{ url: "https://images.test/expired.png" }]
        }), { status: 200 }),
        downloadFetchImpl: async () => new Response("", { status: 410 })
      }),
      (error) => {
        assert.equal(error.code, "IMAGE_PROVIDER_DOWNLOAD_ERROR");
        assert.equal(error.providerStatus, 200);
        assert.equal(error.possiblyBilled, true);
        return true;
      }
    );
    assert.equal(project.imagePackage.image_generation[0].status, "failed");
    assert.equal(
      project.imagePackage.image_generation[0].error.code,
      "IMAGE_PROVIDER_DOWNLOAD_ERROR"
    );
  });
});

test("visual retry preserves a completed local image and only generates the missing one", async () => {
  await withProviderEnv(dualImageEnv(), async () => {
    const project = reviewedProject();
    project.assets = [{ storedName: "shoe.png", mimeType: "image/png" }];
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z");
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );

    let providerRequests = 0;
    let storedImages = 0;
    const dependencies = {
      fetchImpl: async (_url, options) => {
        providerRequests += 1;
        if (options.headers.Authorization === "Bearer test-codesonline-key-2222") {
          return new Response("", {
            status: 524,
            headers: { "x-request-id": "req-2" }
          });
        }
        return new Response(JSON.stringify({
          data: [{ b64_json: tinyPngBytes.toString("base64") }]
        }), { status: 200 });
      },
      readFileImpl: async () => Buffer.from("synthetic-shoe-reference"),
      storeGeneratedImageImpl: async (projectId, bytes, mimeType) => {
        storedImages += 1;
        return {
          url: `/uploads/${projectId}/partial-${storedImages}.png`,
          storedName: `partial-${storedImages}.png`,
          mimeType,
          size: bytes.length
        };
      }
    };

    await assert.rejects(
      generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", dependencies),
      (error) => error.code === "IMAGE_PROVIDER_TIMEOUT"
    );
    assert.equal(
      project.imagePackage.image_generation[0].generated_image.url,
      "/uploads/provider-project/partial-1.png"
    );
    assert.equal(project.imagePackage.image_generation[0].provider_diagnostics.projectId, "provider-project");
    assert.equal(project.imagePackage.image_generation[0].provider_diagnostics.promptCharCount > 0, true);
    assert.equal(project.imagePackage.image_generation[0].provider_diagnostics.referenceImageCount, 1);
    assert.equal(
      project.imagePackage.image_generation[0].provider_diagnostics.referenceImageTotalBytes,
      Buffer.from("synthetic-shoe-reference").length
    );
    assert.equal(project.imagePackage.image_generation[0].provider_diagnostics.drawChannelId, "primary");
    assert.equal(project.imagePackage.image_generation[0].provider_diagnostics.keyPreview, "•••• 1111");
    assert.equal(
      Object.prototype.hasOwnProperty.call(project.imagePackage.image_generation[0].provider_diagnostics, "prompt"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(project.imagePackage.image_generation[0].provider_diagnostics, "base64"),
      false
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(project.imagePackage.image_generation[0].provider_diagnostics, "apiKey"),
      false
    );
    assert.equal(project.imagePackage.image_generation[1].status, "failed");
    assert.equal(project.imagePackage.image_generation[1].error.retryable, true);
    assert.equal(project.imagePackage.image_generation[1].provider_diagnostics.providerStatus, 524);
    assert.equal(project.imagePackage.image_generation[1].provider_diagnostics.providerRequestId, "req-2");
    assert.equal(project.imagePackage.image_generation[1].provider_diagnostics.drawChannelId, "secondary");
    assert.equal(project.imagePackage.image_generation[1].provider_diagnostics.keyPreview, "•••• 2222");
    assert.equal(project.imagePackage.image_generation[1].generated_image, undefined);

    dependencies.fetchImpl = async (_url, options) => {
      providerRequests += 1;
      assert.equal(options.headers.Authorization, "Bearer test-codesonline-key-2222");
      return new Response(JSON.stringify({
        data: [{ b64_json: tinyPngBytes.toString("base64") }]
      }), { status: 200 });
    };

    await generateProjectVisuals(project, "2026-06-06T01:30:00.000Z", dependencies);
    assert.equal(providerRequests, 3);
    assert.equal(storedImages, 2);
    assert.equal(
      project.imagePackage.image_generation[0].generated_image.url,
      "/uploads/provider-project/partial-1.png"
    );
    assert.equal(
      project.imagePackage.image_generation[1].generated_image.url,
      "/uploads/provider-project/partial-2.png"
    );
  });
});

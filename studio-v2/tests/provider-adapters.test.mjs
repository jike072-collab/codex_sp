import test from "node:test";
import assert from "node:assert/strict";

import { analyzeProject } from "../src/ai-providers/vision-provider.mjs";
import { generateProjectScript } from "../src/ai-providers/text-provider.mjs";
import { generateProjectVisuals } from "../src/ai-providers/image-provider.mjs";
import { postProviderJson } from "../src/ai-providers/provider-utils.mjs";
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

test("DeepSeek adapter requests JSON and validates the generated 20-second script", async () => {
  await withProviderEnv({
    TEXT_MODEL_API_KEY: "test-deepseek-key",
    TEXT_API_URL: "https://api.deepseek.test/chat/completions",
    TEXT_MODEL: "deepseek-v4-pro"
  }, async () => {
    const project = reviewedProject();
    const modelOutput = generateDemoPlanningPackage(structuredClone(project));
    let requestBody;
    await generateProjectScript(project, "2026-06-06T01:00:00.000Z", {
      fetchImpl: async (url, options) => {
        assert.equal(url, "https://api.deepseek.test/chat/completions");
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify(modelOutput) } }]
        }), { status: 200 });
      }
    });

    assert.equal(requestBody.model, "deepseek-v4-pro");
    const userPayload = JSON.parse(requestBody.messages[1].content);
    assert.equal(userPayload.shots_per_10s_segment, 5);
    assert.deepEqual(requestBody.response_format, { type: "json_object" });
    assert.deepEqual(requestBody.thinking, { type: "enabled" });
    assert.equal(project.planningPackage.mode, "api");
    assert.equal(project.planningPackage.script_20s.total_duration_sec, 20);
    assert.equal(project.scriptGeneratedAt, "2026-06-06T01:00:00.000Z");
  });
});

test("Right Code image adapter generates two referenced storyboard requests", async () => {
  await withProviderEnv({
    IMAGE_MODEL_API_KEY: "test-right-code-key",
    IMAGE_API_URL: "https://example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_MODEL_PROVIDER: "right_codes"
  }, async () => {
    const project = reviewedProject();
    project.marketBrief.outputAspectRatio = "4:5";
    project.assets = [{
      storedName: "shoe.png",
      mimeType: "image/png"
    }];
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
    const referenceBytes = Buffer.from("synthetic-shoe-reference");
    await generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", {
      uploadsRootPath: "C:\\synthetic-uploads",
      readFileImpl: async (path) => {
        assert.match(path, /provider-project[\\/]shoe\.png$/);
        return referenceBytes;
      },
      fetchImpl: async (url, options) => {
        assert.equal(url, "https://example.test/draw/v1/images/generations");
        assert.equal(options.headers.Authorization, "Bearer test-right-code-key");
        assert.equal(options.headers["Content-Type"], "application/json");
        requests.push(JSON.parse(options.body));
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
    assert.equal(requests[0].model, "gpt-image-2");
    assert.equal(typeof requests[0].prompt, "string");
    assert.deepEqual(requests[0].image, [referenceBytes.toString("base64")]);
    assert.equal(requests[0].image[0].startsWith("data:image/"), false);
    assert.equal(requests[0].size, "1536x1024");
    assert.equal(requests[1].size, "1536x1024");
    assert.match(requests[0].prompt, /internal shot thumbnail\/panel must be composed as a 4:5 video frame/);
    assert.doesNotMatch(requests[0].prompt, /Create one 4:5 commercial storyboard board/);
    assert.equal(requests[0].response_format, "url");
    assert.equal(project.imagePackage.mode, "api");
    assert.equal(
      project.imagePackage.image_generation[1].generated_image.url,
      "/uploads/provider-project/storyboard-2.png"
    );
    assert.equal(
      project.imagePackage.image_generation[0].generated_image.sourceUrl,
      "https://images.test/1.png"
    );
  });
});

test("Right Code image adapter starts both missing storyboard requests before either response resolves", async () => {
  await withProviderEnv({
    IMAGE_MODEL_API_KEY: "test-right-code-key",
    IMAGE_API_URL: "https://example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_MODEL_PROVIDER: "right_codes"
  }, async () => {
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
      fetchImpl: async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(body.image.length, 1);
        requests.push(body);
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
      requests[0].prompt,
      requests[1].prompt,
      "Each concurrent request should still target its own storyboard segment."
    );

    releases[0].resolve();
    releases[1].resolve();
    await generationPromise;

    assert.equal(releasedResponses, 2);
    assert.equal(storedImages, 2);
    assert.equal(project.imagePackage.mode, "api");
  });
});

test("Right Code image adapter does not fall back when references are forbidden", async () => {
  await withProviderEnv({
    IMAGE_MODEL_API_KEY: "test-right-code-key",
    IMAGE_API_URL: "https://example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_MODEL_PROVIDER: "right_codes"
  }, async () => {
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
          const body = JSON.parse(options.body);
          requests.push(body);
          assert.equal(body.image.length, 1);
          return new Response(JSON.stringify({
            error: "API Key 不允许访问该渠道，请前往令牌管理界面修改令牌权限"
          }), { status: 403 });
        }
      }),
      (error) => {
        assert.equal(error.code, "IMAGE_PROVIDER_ERROR");
        assert.equal(error.providerStatus, 403);
        return true;
      }
    );

    assert.equal(requests.length, 2);
    assert.equal(project.imagePackage.image_generation[0].generated_image, undefined);
    assert.equal(project.imagePackage.image_generation[1].generated_image, undefined);
  });
});

test("Right Code image adapter stores base64 image responses locally", async () => {
  await withProviderEnv({
    IMAGE_MODEL_API_KEY: "test-right-code-key",
    IMAGE_API_URL: "https://example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_MODEL_PROVIDER: "right_codes"
  }, async () => {
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

test("visual retry preserves a completed local image and only generates the missing one", async () => {
  await withProviderEnv({
    IMAGE_MODEL_API_KEY: "test-right-code-key",
    IMAGE_API_URL: "https://example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_MODEL_PROVIDER: "right_codes"
  }, async () => {
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
      fetchImpl: async () => {
        providerRequests += 1;
        if (providerRequests === 2) {
          return new Response("", { status: 524 });
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
    assert.equal(project.imagePackage.image_generation[1].status, "failed");
    assert.equal(project.imagePackage.image_generation[1].error.retryable, true);
    assert.equal(project.imagePackage.image_generation[1].generated_image, undefined);

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

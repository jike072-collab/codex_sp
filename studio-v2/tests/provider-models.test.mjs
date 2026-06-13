import test from "node:test";
import assert from "node:assert/strict";

import {
  clearProviderModelDiscoveryCache,
  discoverAdminProviderModelPreview,
  discoverAdminProviderModels
} from "../src/ai-providers/provider-models.mjs";

const providerEnvKeys = [
  "VISION_MODEL_API_KEY",
  "VISION_MODEL_API_KEY__RIGHT_CODE_GEMINI",
  "VISION_MODEL_API_KEY__SUB2API_LOCAL_CHAT",
  "VISION_MODEL__RIGHT_CODE_GEMINI",
  "VISION_MODEL__SUB2API_LOCAL_CHAT",
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
  "VIDEO_MODEL_API_KEY",
  "VIDEO_API_URL",
  "VIDEO_MODEL"
];

async function withProviderEnv(values, callback) {
  const previous = Object.fromEntries(providerEnvKeys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  clearProviderModelDiscoveryCache();
  try {
    return await callback();
  } finally {
    clearProviderModelDiscoveryCache();
    for (const key of providerEnvKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

test("provider model discovery returns real models, caches them, and refreshes on demand", async () => {
  await withProviderEnv({
    VISION_MODEL_API_KEY: "vision-key",
    VISION_API_URL: "https://vision.example.test/gemini",
    VISION_MODEL: "gemini-2.5-flash",
    TEXT_MODEL_API_KEY: "text-key",
    TEXT_API_URL: "https://text.example.test/chat/completions",
    TEXT_MODEL: "deepseek-v4-pro",
    IMAGE_MODEL_API_KEY: "image-key-a",
    IMAGE_API_URL: "https://image-a.example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_SECONDARY_API_KEY: "image-key-b",
    IMAGE_SECONDARY_API_URL: "https://image-b.example.test/draw/v1/images/generations",
    IMAGE_SECONDARY_MODEL: "gpt-image-2",
    VIDEO_MODEL_API_KEY: "video-key",
    VIDEO_API_URL: "https://video.example.test/v1/videos/generations",
    VIDEO_MODEL: "seedance2.0 720p-fast"
  }, async () => {
    const seenUrls = [];
    const result = await discoverAdminProviderModels({
      fetchImpl: async (url, options) => {
        seenUrls.push({ url, headers: options.headers });
        if (String(url).includes("/gemini/v1beta/models")) {
          assert.equal(options.headers["x-goog-api-key"], "vision-key");
          return jsonResponse({
            models: [
              { name: "models/gemini-2.5-flash", displayName: "Gemini Flash" },
              { name: "models/gemini-2.5-pro", displayName: "Gemini Pro" }
            ]
          });
        }
        if (String(url).includes("text.example.test/models")) {
          assert.equal(options.headers.Authorization, "Bearer text-key");
          return jsonResponse({ data: [{ id: "deepseek-chat" }, { id: "deepseek-v4-pro" }] });
        }
        if (String(url).includes("image-a.example.test/draw/v1/models")) {
          assert.equal(options.headers.Authorization, "Bearer image-key-a");
          return jsonResponse({ data: [{ id: "gpt-image-2" }, { id: "gpt-image-3" }] });
        }
        if (String(url).includes("image-b.example.test/draw/v1/models")) {
          assert.equal(options.headers.Authorization, "Bearer image-key-b");
          return jsonResponse({ data: [{ id: "gpt-image-2" }, { id: "gpt-image-4" }] });
        }
        if (String(url).includes("video.example.test/v1/models")) {
          assert.equal(options.headers.Authorization, "Bearer video-key");
          return jsonResponse({ data: [{ id: "seedance2.0 720p-fast" }, { id: "seedance2.0 1080p" }] });
        }
        throw new Error(`unexpected url: ${url}`);
      }
    });

    assert.equal(result.providers.vision.status, "ok");
    assert.equal(result.providers.text.status, "ok");
    assert.equal(result.providers.image.status, "ok");
    assert.equal(result.providers.video.status, "ok");
    assert.equal(result.providers.image.source, "provider");
    assert.equal(result.providers.image.channels.length, 2);
    assert.deepEqual(result.providers.image.channels.map((channel) => channel.id), [
      "primary",
      "secondary"
    ]);
    assert.ok(result.providers.image.channels[0].models.some((model) => model.id === "gpt-image-3"));
    assert.ok(result.providers.image.channels[1].models.some((model) => model.id === "gpt-image-4"));
    assert.ok(result.providers.video.models.some((model) => model.id === "seedance2.0 1080p"));

    const cached = await discoverAdminProviderModels({
      fetchImpl: async () => {
        throw new Error("cache should prevent repeat fetches");
      }
    });
    assert.deepEqual(cached, result);

    const refreshed = await discoverAdminProviderModels({
      refresh: true,
      fetchImpl: async (url) => {
        if (String(url).includes("/gemini/v1beta/models")) {
          return jsonResponse({ models: [{ name: "models/gemini-2.5-flash" }] });
        }
        if (String(url).includes("text.example.test/models")) {
          return jsonResponse({ data: [{ id: "deepseek-v4-pro" }] });
        }
        if (String(url).includes("image-a.example.test/draw/v1/models")) {
          return jsonResponse({ data: [{ id: "gpt-image-2" }] });
        }
        if (String(url).includes("image-b.example.test/draw/v1/models")) {
          return jsonResponse({ data: [{ id: "gpt-image-2" }] });
        }
        if (String(url).includes("video.example.test/v1/models")) {
          return jsonResponse({ data: [{ id: "seedance2.0 720p-fast" }] });
        }
        throw new Error(`unexpected url: ${url}`);
      }
    });
    assert.equal(refreshed.providers.vision.models.length, 1);
    assert.equal(refreshed.providers.image.channels[0].models.length, 1);
    assert.equal(refreshed.providers.video.models.length, 1);
    assert.equal(seenUrls.length >= 5, true);
  });
});

test("provider model preview uses preset-local keys for unsaved endpoint switches", async () => {
  await withProviderEnv({
    VISION_MODEL_API_KEY: "right-code-key",
    VISION_MODEL_API_KEY__SUB2API_LOCAL_CHAT: "sub2api-chat-key",
    VISION_MODEL__SUB2API_LOCAL_CHAT: "gemini-2.5-flash",
    VISION_API_URL: "https://right.codes/gemini",
    VISION_MODEL: "gemini-2.5-flash"
  }, async () => {
    const result = await discoverAdminProviderModelPreview({
      providerId: "vision",
      apiUrl: "http://127.0.0.1:8080/v1/chat/completions",
      model: "gemini-2.5-flash"
    }, {
      fetchImpl: async (url, options) => {
        assert.equal(String(url), "http://127.0.0.1:8080/v1/models");
        assert.equal(options.headers.Authorization, "Bearer sub2api-chat-key");
        assert.equal(options.headers["x-goog-api-key"], undefined);
        return jsonResponse({
          data: [
            { id: "gemini-2.5-flash" },
            { id: "gemini-2.5-pro" }
          ]
        });
      }
    });

    assert.equal(result.providers.vision.status, "ok");
    assert.ok(result.providers.vision.models.some((model) => model.id === "gemini-2.5-pro"));
  });
});

test("provider model preview does not reuse another preset key", async () => {
  await withProviderEnv({
    VISION_MODEL_API_KEY: "right-code-key",
    VISION_API_URL: "https://right.codes/gemini",
    VISION_MODEL: "gemini-2.5-flash"
  }, async () => {
    const result = await discoverAdminProviderModelPreview({
      providerId: "vision",
      apiUrl: "http://127.0.0.1:8080/v1/chat/completions",
      model: "gemini-2.5-flash"
    }, {
      fetchImpl: async () => {
        throw new Error("missing preset key should not call provider");
      }
    });

    assert.equal(result.providers.vision.status, "error");
    assert.equal(result.providers.vision.models[0].id, "gemini-2.5-flash");
  });
});

test("provider model discovery degrades safely for unsupported and error responses", async () => {
  await withProviderEnv({
    VISION_MODEL_API_KEY: "vision-key",
    VISION_API_URL: "https://vision.example.test/gemini",
    VISION_MODEL: "gemini-2.5-flash",
    TEXT_MODEL_API_KEY: "text-key",
    TEXT_API_URL: "https://text.example.test/chat/completions",
    TEXT_MODEL: "deepseek-v4-pro",
    IMAGE_MODEL_API_KEY: "image-key-a",
    IMAGE_API_URL: "https://image-a.example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_SECONDARY_API_KEY: "image-key-b",
    IMAGE_SECONDARY_API_URL: "https://image-b.example.test/draw/v1/images/generations",
    IMAGE_SECONDARY_MODEL: "gpt-image-2",
    VIDEO_MODEL_API_KEY: "video-key",
    VIDEO_API_URL: "https://video.example.test/v1/videos/generations",
    VIDEO_MODEL: "seedance2.0 720p-fast"
  }, async () => {
    const result = await discoverAdminProviderModels({
      fetchImpl: async (url) => {
        if (String(url).includes("/gemini/v1beta/models")) {
          return jsonResponse({ models: [{ name: "models/gemini-2.5-flash" }] });
        }
        if (String(url).includes("text.example.test/models")) {
          return new Response("", { status: 500 });
        }
        if (String(url).includes("image-a.example.test/draw/v1/models")) {
          return new Response("", { status: 404 });
        }
        if (String(url).includes("image-b.example.test/draw/v1/models")) {
          return new Response("", { status: 500 });
        }
        if (String(url).includes("video.example.test/v1/models")) {
          return new Response("", { status: 404 });
        }
        throw new Error(`unexpected url: ${url}`);
      }
    });

    assert.equal(result.providers.vision.status, "ok");
    assert.equal(result.providers.text.status, "error");
    assert.equal(result.providers.text.models.length, 1);
    assert.equal(result.providers.text.models[0].id, "deepseek-v4-pro");
    assert.equal(result.providers.image.status, "error");
    assert.equal(result.providers.image.channels[0].status, "unsupported");
    assert.equal(result.providers.image.channels[1].status, "error");
    assert.equal(result.providers.image.channels[0].models[0].id, "gpt-image-2");
    assert.equal(result.providers.image.channels[1].models[0].id, "gpt-image-2");
    assert.equal(result.providers.video.status, "unsupported");
    assert.equal(result.providers.video.models[0].id, "seedance2.0 720p-fast");
    assert.match(result.providers.text.message, /HTTP 500/);
    assert.match(result.providers.image.channels[0].message, /模型列表端点/);
    assert.match(result.providers.image.channels[1].message, /HTTP 500/);
    assert.match(result.providers.video.message, /模型列表端点/);
  });
});

test("provider model discovery cache is invalidated when API keys change", async () => {
  await withProviderEnv({
    VISION_MODEL_API_KEY: "vision-key-a",
    VISION_API_URL: "https://vision.example.test/gemini",
    VISION_MODEL: "gemini-2.5-flash",
    TEXT_MODEL_API_KEY: "text-key-a",
    TEXT_API_URL: "https://text.example.test/chat/completions",
    TEXT_MODEL: "deepseek-v4-pro",
    IMAGE_MODEL_API_KEY: "image-key-a",
    IMAGE_API_URL: "https://image-a.example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_SECONDARY_API_KEY: "image-key-b",
    IMAGE_SECONDARY_API_URL: "https://image-b.example.test/draw/v1/images/generations",
    IMAGE_SECONDARY_MODEL: "gpt-image-2",
    VIDEO_MODEL_API_KEY: "video-key-a",
    VIDEO_API_URL: "https://video.example.test/v1/videos/generations",
    VIDEO_MODEL: "seedance2.0 720p-fast"
  }, async () => {
    const requestCounts = new Map();
    const fetchImpl = async (url, options) => {
      const auth = options.headers["x-goog-api-key"] || options.headers.Authorization;
      const key = `${url}|${auth}`;
      requestCounts.set(key, (requestCounts.get(key) || 0) + 1);

      if (String(url).includes("/gemini/v1beta/models")) {
        return jsonResponse({
          models: [{ name: `models/gemini-${auth === "vision-key-a" ? "alpha" : "beta"}` }]
        });
      }
      if (String(url).includes("text.example.test/models")) {
        return jsonResponse({
          data: [{ id: auth === "Bearer text-key-a" ? "deepseek-alpha" : "deepseek-beta" }]
        });
      }
      if (String(url).includes("image-a.example.test/draw/v1/models")) {
        return jsonResponse({
          data: [{ id: auth === "Bearer image-key-a" ? "gpt-image-a1" : "gpt-image-a2" }]
        });
      }
      if (String(url).includes("image-b.example.test/draw/v1/models")) {
        return jsonResponse({
          data: [{ id: auth === "Bearer image-key-b" ? "gpt-image-b1" : "gpt-image-b2" }]
        });
      }
      if (String(url).includes("video.example.test/v1/models")) {
        return jsonResponse({
          data: [{ id: auth === "Bearer video-key-a" ? "seedance-alpha" : "seedance-beta" }]
        });
      }
      throw new Error(`unexpected url: ${url}`);
    };

    const first = await discoverAdminProviderModels({ fetchImpl });
    assert.ok(first.providers.vision.models.some((model) => model.id === "gemini-alpha"));
    assert.ok(first.providers.text.models.some((model) => model.id === "deepseek-alpha"));
    assert.ok(first.providers.image.channels[0].models.some((model) => model.id === "gpt-image-a1"));
    assert.ok(first.providers.image.channels[1].models.some((model) => model.id === "gpt-image-b1"));
    assert.ok(first.providers.video.models.some((model) => model.id === "seedance-alpha"));

    process.env.VISION_MODEL_API_KEY = "vision-key-z";
    process.env.TEXT_MODEL_API_KEY = "text-key-z";
    process.env.IMAGE_MODEL_API_KEY = "image-key-z";
    process.env.IMAGE_SECONDARY_API_KEY = "image-key-y";
    process.env.VIDEO_MODEL_API_KEY = "video-key-z";

    const second = await discoverAdminProviderModels({ fetchImpl });
    assert.ok(second.providers.vision.models.some((model) => model.id === "gemini-beta"));
    assert.ok(second.providers.text.models.some((model) => model.id === "deepseek-beta"));
    assert.ok(second.providers.image.channels[0].models.some((model) => model.id === "gpt-image-a2"));
    assert.ok(second.providers.image.channels[1].models.some((model) => model.id === "gpt-image-b2"));
    assert.ok(second.providers.video.models.some((model) => model.id === "seedance-beta"));
    assert.equal(second.providers.vision.models.some((model) => model.id === "gemini-alpha"), false);
    assert.equal(second.providers.text.models.some((model) => model.id === "deepseek-alpha"), false);
    assert.equal(second.providers.image.channels[0].models.some((model) => model.id === "gpt-image-a1"), false);
    assert.equal(second.providers.image.channels[1].models.some((model) => model.id === "gpt-image-b1"), false);
    assert.equal(second.providers.video.models.some((model) => model.id === "seedance-alpha"), false);

    assert.equal(
      [...requestCounts.keys()].filter((key) => key.includes("vision.example.test")).length,
      2
    );
    assert.equal(
      [...requestCounts.keys()].filter((key) => key.includes("text.example.test")).length,
      2
    );
    assert.equal(
      [...requestCounts.keys()].filter((key) => key.includes("image-a.example.test")).length,
      2
    );
    assert.equal(
      [...requestCounts.keys()].filter((key) => key.includes("image-b.example.test")).length,
      2
    );
    assert.equal(
      [...requestCounts.keys()].filter((key) => key.includes("video.example.test")).length,
      2
    );

    const cached = await discoverAdminProviderModels({
      fetchImpl: async () => {
        throw new Error("updated key cache should satisfy repeated reads");
      }
    });
    assert.deepEqual(cached, second);
  });
});

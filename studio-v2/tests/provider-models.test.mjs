import test from "node:test";
import assert from "node:assert/strict";

import {
  clearProviderModelDiscoveryCache,
  discoverAdminProviderModels
} from "../src/ai-providers/provider-models.mjs";

const providerEnvKeys = [
  "VISION_MODEL_API_KEY",
  "VISION_API_URL",
  "VISION_MODEL",
  "TEXT_MODEL_API_KEY",
  "TEXT_API_URL",
  "TEXT_MODEL",
  "IMAGE_MODEL_API_KEY",
  "IMAGE_API_URL",
  "IMAGE_MODEL"
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
    IMAGE_MODEL_API_KEY: "image-key",
    IMAGE_API_URL: "https://image.example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2"
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
        if (String(url).includes("/chat/models")) {
          throw new Error("unexpected path");
        }
        if (String(url).includes("/text.example.test/models")) {
          assert.equal(options.headers.Authorization, "Bearer text-key");
          return jsonResponse({ data: [{ id: "deepseek-chat" }, { id: "deepseek-v4-pro" }] });
        }
        if (String(url).includes("/draw/v1/models")) {
          assert.equal(options.headers.Authorization, "Bearer image-key");
          return jsonResponse({ data: [{ id: "gpt-image-2" }, { id: "gpt-image-3" }] });
        }
        throw new Error(`unexpected url: ${url}`);
      }
    });

    assert.equal(result.providers.vision.status, "ok");
    assert.equal(result.providers.text.status, "ok");
    assert.equal(result.providers.image.status, "ok");
    assert.equal(result.providers.vision.source, "provider");
    assert.equal(result.providers.text.source, "provider");
    assert.equal(result.providers.image.source, "provider");
    assert.deepEqual(result.providers.vision.models.map((model) => model.id), [
      "gemini-2.5-flash",
      "gemini-2.5-pro"
    ]);
    assert.ok(result.providers.text.models.some((model) => model.id === "deepseek-v4-pro"));
    assert.ok(result.providers.image.models.some((model) => model.id === "gpt-image-2"));

    const cached = await discoverAdminProviderModels({
      fetchImpl: async () => {
        throw new Error("cache should prevent repeat fetches");
      }
    });
    assert.deepEqual(cached, result);

    const refreshed = await discoverAdminProviderModels({
      refresh: true,
      fetchImpl: async (url, options) => {
        if (String(url).includes("/gemini/v1beta/models")) {
          return jsonResponse({ models: [{ name: "models/gemini-2.5-flash" }] });
        }
        if (String(url).includes("/text.example.test/models")) {
          return jsonResponse({ data: [{ id: "deepseek-v4-pro" }] });
        }
        if (String(url).includes("/draw/v1/models")) {
          return jsonResponse({ data: [{ id: "gpt-image-2" }] });
        }
        throw new Error(`unexpected url: ${url}`);
      }
    });
    assert.equal(refreshed.providers.vision.models.length, 1);
    assert.equal(seenUrls.length >= 3, true);
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
    IMAGE_MODEL_API_KEY: "image-key",
    IMAGE_API_URL: "https://image.example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2"
  }, async () => {
    const result = await discoverAdminProviderModels({
      fetchImpl: async (url) => {
        if (String(url).includes("/gemini/v1beta/models")) {
          return jsonResponse({ models: [{ name: "models/gemini-2.5-flash" }] });
        }
        if (String(url).includes("/text.example.test/models")) {
          return new Response("", { status: 500 });
        }
        if (String(url).includes("/draw/v1/models")) {
          return new Response("", { status: 404 });
        }
        throw new Error(`unexpected url: ${url}`);
      }
    });

    assert.equal(result.providers.vision.status, "ok");
    assert.equal(result.providers.text.status, "error");
    assert.equal(result.providers.text.models.length, 1);
    assert.equal(result.providers.text.models[0].id, "deepseek-v4-pro");
    assert.equal(result.providers.image.status, "unsupported");
    assert.equal(result.providers.image.models.length, 1);
    assert.equal(result.providers.image.models[0].id, "gpt-image-2");
    assert.match(result.providers.text.message, /HTTP 500/);
    assert.match(result.providers.image.message, /模型列表端点/);
  });
});

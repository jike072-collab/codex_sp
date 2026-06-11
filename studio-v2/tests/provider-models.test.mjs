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
  "IMAGE_MODEL",
  "IMAGE_SECONDARY_API_KEY",
  "IMAGE_SECONDARY_API_URL",
  "IMAGE_SECONDARY_MODEL"
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
    IMAGE_SECONDARY_MODEL: "gpt-image-2"
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
        throw new Error(`unexpected url: ${url}`);
      }
    });

    assert.equal(result.providers.vision.status, "ok");
    assert.equal(result.providers.text.status, "ok");
    assert.equal(result.providers.image.status, "ok");
    assert.equal(result.providers.image.source, "provider");
    assert.equal(result.providers.image.channels.length, 2);
    assert.deepEqual(result.providers.image.channels.map((channel) => channel.id), [
      "primary",
      "secondary"
    ]);
    assert.ok(result.providers.image.channels[0].models.some((model) => model.id === "gpt-image-3"));
    assert.ok(result.providers.image.channels[1].models.some((model) => model.id === "gpt-image-4"));

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
        throw new Error(`unexpected url: ${url}`);
      }
    });
    assert.equal(refreshed.providers.vision.models.length, 1);
    assert.equal(refreshed.providers.image.channels[0].models.length, 1);
    assert.equal(seenUrls.length >= 4, true);
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
    IMAGE_SECONDARY_MODEL: "gpt-image-2"
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
    assert.match(result.providers.text.message, /HTTP 500/);
    assert.match(result.providers.image.channels[0].message, /模型列表端点/);
    assert.match(result.providers.image.channels[1].message, /HTTP 500/);
  });
});

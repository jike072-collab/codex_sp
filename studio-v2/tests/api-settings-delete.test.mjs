import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

let baseUrl;
let server;
let dataRoot;
let envPath;
let repository;

const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...options.headers }
      : options.headers
  });
  return {
    response,
    body: await response.json()
  };
}

function providerById(body, id) {
  return body.providers.find((provider) => provider.id === id);
}

function imageChannel(provider, channelId) {
  return provider.config.channels.find((channel) => channel.id === channelId);
}

before(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "shoe-ad-studio-settings-"));
  envPath = join(dataRoot, ".env");
  process.env.STUDIO_DATA_ROOT = dataRoot;
  process.env.STUDIO_ENV_PATH = envPath;
  for (const key of providerEnvKeys) delete process.env[key];

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
  delete process.env.STUDIO_ENV_PATH;
  const resolvedTemp = resolve(tmpdir());
  const resolvedData = resolve(dataRoot);
  const pathFromTemp = relative(resolvedTemp, resolvedData);
  if (!pathFromTemp.startsWith("..") && pathFromTemp.startsWith("shoe-ad-studio-settings-")) {
    await rm(resolvedData, { recursive: true, force: true });
  }
});

test("public provider status stays redacted while admin settings persist locally", async () => {
  const initial = await request("/api/settings/providers/status");
  assert.equal(initial.response.status, 200);
  assert.deepEqual(initial.body.providers, {
    vision: { configured: false },
    text: { configured: false },
    image: { configured: false }
  });
  assert.equal(initial.body.configuredCount, 0);
  assert.equal(initial.body.total, 3);
  assert.equal(JSON.stringify(initial.body).includes("apiUrl"), false);
  assert.equal(JSON.stringify(initial.body).includes("model"), false);
  assert.equal(JSON.stringify(initial.body).includes("keyPreview"), false);

  const legacyStatus = await request("/api/settings/providers");
  assert.deepEqual(legacyStatus.body, initial.body);

  const schema = await request("/api/admin/providers");
  assert.equal(schema.response.status, 200);
  assert.equal(schema.body.schemaVersion, 2);
  assert.deepEqual(
    schema.body.providers.map((provider) => provider.id),
    ["vision", "text", "image"]
  );
  assert.equal(providerById(schema.body, "vision").title, "识图模型");
  assert.equal(providerById(schema.body, "vision").fields.some(
    (field) => field.valueKey === "visionApiUrl" && field.label === "API 地址"
  ), true);
  assert.equal(providerById(schema.body, "vision").fields.some(
    (field) => field.valueKey === "visionModel" && field.type === "select"
  ), true);
  assert.deepEqual(providerById(schema.body, "image").channels.map((channel) => channel.id), [
    "primary",
    "secondary"
  ]);
  assert.equal(providerById(schema.body, "image").fields.some(
    (field) => field.valueKey === "imageSecondaryModel" && field.type === "select"
  ), true);
  assert.equal(JSON.stringify(schema.body).includes("VISION_MODEL_API_KEY"), false);

  const updated = await request("/api/admin/providers", {
    method: "PUT",
    body: JSON.stringify({
      visionApiUrl: "https://vision.example.test/gemini",
      visionModel: "gemini-test",
      visionApiKey: "vision-secret",
      textApiUrl: "https://text.example.test/chat/completions",
      textModel: "deepseek-test",
      deepSeekApiKey: "deepseek-secret",
      imageApiUrl: "https://image-a.example.test/draw/v1/images/generations",
      imageModel: "image-a-test",
      imageApiKey: "image-primary-secret",
      imageSecondaryApiUrl: "https://image-b.example.test/draw/v1/images/generations",
      imageSecondaryModel: "image-b-test",
      imageSecondaryApiKey: "image-secondary-secret"
    })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(providerById(updated.body, "vision").config.configured, true);
  assert.equal(providerById(updated.body, "text").config.configured, true);
  assert.equal(providerById(updated.body, "image").config.configured, true);
  assert.equal(providerById(updated.body, "vision").config.apiUrl, "https://vision.example.test/gemini");
  assert.equal(providerById(updated.body, "text").config.model, "deepseek-test");
  assert.equal(imageChannel(providerById(updated.body, "image"), "primary").keyPreview, "•••• cret");
  assert.equal(imageChannel(providerById(updated.body, "image"), "secondary").keyPreview, "•••• cret");
  assert.equal(providerById(updated.body, "image").config.configuredChannels, 2);
  assert.equal(JSON.stringify(updated.body).includes("vision-secret"), false);
  assert.equal(JSON.stringify(updated.body).includes("deepseek-secret"), false);
  assert.equal(JSON.stringify(updated.body).includes("image-primary-secret"), false);
  assert.equal(JSON.stringify(updated.body).includes("image-secondary-secret"), false);

  let stored = await readFile(envPath, "utf8");
  assert.match(stored, /VISION_API_URL=https:\/\/vision\.example\.test\/gemini/);
  assert.match(stored, /VISION_MODEL=gemini-test/);
  assert.match(stored, /VISION_MODEL_API_KEY=vision-secret/);
  assert.match(stored, /TEXT_API_URL=https:\/\/text\.example\.test\/chat\/completions/);
  assert.match(stored, /TEXT_MODEL=deepseek-test/);
  assert.match(stored, /TEXT_MODEL_API_KEY=deepseek-secret/);
  assert.match(stored, /IMAGE_API_URL=https:\/\/image-a\.example\.test\/draw\/v1\/images\/generations/);
  assert.match(stored, /IMAGE_MODEL=image-a-test/);
  assert.match(stored, /IMAGE_MODEL_API_KEY=image-primary-secret/);
  assert.match(stored, /IMAGE_SECONDARY_API_URL=https:\/\/image-b\.example\.test\/draw\/v1\/images\/generations/);
  assert.match(stored, /IMAGE_SECONDARY_MODEL=image-b-test/);
  assert.match(stored, /IMAGE_SECONDARY_API_KEY=image-secondary-secret/);

  const publicAfterUpdate = await request("/api/settings/providers/status");
  assert.equal(publicAfterUpdate.body.configuredCount, 3);
  assert.equal(JSON.stringify(publicAfterUpdate.body).includes("vision.example.test"), false);
  assert.equal(JSON.stringify(publicAfterUpdate.body).includes("gemini-test"), false);
  assert.equal(JSON.stringify(publicAfterUpdate.body).includes("cret"), false);

  const visionUpdated = await request("/api/admin/providers", {
    method: "PUT",
    body: JSON.stringify({ visionApiKey: "new-vision-secret", visionModel: "gemini-new" })
  });
  assert.equal(providerById(visionUpdated.body, "vision").config.configured, true);
  assert.equal(providerById(visionUpdated.body, "vision").config.model, "gemini-new");
  assert.equal(providerById(visionUpdated.body, "text").config.configured, true);
  assert.equal(providerById(visionUpdated.body, "image").config.configured, true);
  stored = await readFile(envPath, "utf8");
  assert.match(stored, /VISION_MODEL_API_KEY=new-vision-secret/);
  assert.match(stored, /VISION_MODEL=gemini-new/);
  assert.match(stored, /IMAGE_MODEL_API_KEY=image-primary-secret/);
  assert.match(stored, /IMAGE_SECONDARY_API_KEY=image-secondary-secret/);

  const independentKeysUpdated = await request("/api/admin/providers", {
    method: "PUT",
    body: JSON.stringify({
      visionApiKey: "independent-vision-key",
      imageApiKey: "independent-image-key-a",
      imageSecondaryApiKey: "independent-image-key-b"
    })
  });
  assert.equal(independentKeysUpdated.response.status, 200);
  stored = await readFile(envPath, "utf8");
  assert.match(stored, /VISION_MODEL_API_KEY=independent-vision-key/);
  assert.match(stored, /IMAGE_MODEL_API_KEY=independent-image-key-a/);
  assert.match(stored, /IMAGE_SECONDARY_API_KEY=independent-image-key-b/);

  const visionCleared = await request("/api/admin/providers", {
    method: "PUT",
    body: JSON.stringify({ visionApiKey: null })
  });
  assert.equal(providerById(visionCleared.body, "vision").config.configured, false);
  assert.equal(providerById(visionCleared.body, "text").config.configured, true);
  assert.equal(providerById(visionCleared.body, "image").config.configured, true);

  const allCleared = await request("/api/admin/providers", {
    method: "PUT",
    body: JSON.stringify({
      visionApiKey: null,
      deepSeekApiKey: null,
      imageApiKey: null,
      imageSecondaryApiKey: null
    })
  });
  assert.equal(providerById(allCleared.body, "vision").config.configured, false);
  assert.equal(providerById(allCleared.body, "text").config.configured, false);
  assert.equal(providerById(allCleared.body, "image").config.configured, false);
});

test("admin provider settings validate URLs and serve the admin page", async () => {
  const invalidUrl = await request("/api/admin/providers", {
    method: "PUT",
    body: JSON.stringify({ imageApiUrl: "ftp://image.example.test" })
  });
  assert.equal(invalidUrl.response.status, 400);
  assert.equal(invalidUrl.body.code, "INVALID_PROVIDER_SETTINGS");

  const invalidModel = await request("/api/admin/providers", {
    method: "PUT",
    body: JSON.stringify({ imageModel: "bad\nmodel" })
  });
  assert.equal(invalidModel.response.status, 400);
  assert.equal(invalidModel.body.code, "INVALID_PROVIDER_SETTINGS");

  const adminPage = await fetch(`${baseUrl}/admin/`);
  assert.equal(adminPage.status, 200);
  assert.match(adminPage.headers.get("content-type"), /text\/html/);
  assert.match(await adminPage.text(), /供应商配置后台/);
});

test("admin provider models API discovers models and honors refresh", async () => {
  const providerRequests = [];
  const providerServer = http.createServer((req, res) => {
    providerRequests.push(req.url);
    if (req.url.includes("/vision/gemini/v1beta/models")) {
      assert.equal(req.headers["x-goog-api-key"], "vision-secret");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        models: [{ name: "models/gemini-2.5-flash", displayName: "Gemini Flash" }]
      }));
      return;
    }
    if (req.url.includes("/text/models")) {
      assert.equal(req.headers.authorization, "Bearer text-secret");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        data: [{ id: "deepseek-v4-pro" }]
      }));
      return;
    }
    if (req.url.includes("/image-a/draw/v1/models")) {
      assert.equal(req.headers.authorization, "Bearer image-primary-secret");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        data: [{ id: "gpt-image-2" }, { id: "gpt-image-3" }]
      }));
      return;
    }
    if (req.url.includes("/image-b/draw/v1/models")) {
      assert.equal(req.headers.authorization, "Bearer image-secondary-secret");
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unexpected" }));
  });
  await new Promise((resolveListen, reject) => {
    providerServer.once("error", reject);
    providerServer.listen(0, "127.0.0.1", resolveListen);
  });
  const address = providerServer.address();
  const providerBase = `http://127.0.0.1:${address.port}`;

  const previous = {
    VISION_MODEL_API_KEY: process.env.VISION_MODEL_API_KEY,
    VISION_API_URL: process.env.VISION_API_URL,
    VISION_MODEL: process.env.VISION_MODEL,
    TEXT_MODEL_API_KEY: process.env.TEXT_MODEL_API_KEY,
    TEXT_API_URL: process.env.TEXT_API_URL,
    TEXT_MODEL: process.env.TEXT_MODEL,
    IMAGE_MODEL_API_KEY: process.env.IMAGE_MODEL_API_KEY,
    IMAGE_API_URL: process.env.IMAGE_API_URL,
    IMAGE_MODEL: process.env.IMAGE_MODEL,
    IMAGE_SECONDARY_API_KEY: process.env.IMAGE_SECONDARY_API_KEY,
    IMAGE_SECONDARY_API_URL: process.env.IMAGE_SECONDARY_API_URL,
    IMAGE_SECONDARY_MODEL: process.env.IMAGE_SECONDARY_MODEL
  };
  Object.assign(process.env, {
    VISION_MODEL_API_KEY: "vision-secret",
    VISION_API_URL: `${providerBase}/vision/gemini`,
    VISION_MODEL: "gemini-2.5-flash",
    TEXT_MODEL_API_KEY: "text-secret",
    TEXT_API_URL: `${providerBase}/text/chat/completions`,
    TEXT_MODEL: "deepseek-v4-pro",
    IMAGE_MODEL_API_KEY: "image-primary-secret",
    IMAGE_API_URL: `${providerBase}/image-a/draw/v1/images/generations`,
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_SECONDARY_API_KEY: "image-secondary-secret",
    IMAGE_SECONDARY_API_URL: `${providerBase}/image-b/draw/v1/images/generations`,
    IMAGE_SECONDARY_MODEL: "gpt-image-2"
  });

  try {
    const first = await request("/api/admin/providers/models");
    assert.equal(first.response.status, 200);
    assert.equal(first.body.providers.vision.status, "ok");
    assert.equal(first.body.providers.text.status, "ok");
    assert.equal(first.body.providers.image.status, "partial");
    assert.equal(first.body.providers.image.channels[0].status, "ok");
    assert.equal(first.body.providers.image.channels[1].status, "unsupported");
    assert.ok(first.body.providers.image.channels[0].models.some((model) => model.id === "gpt-image-3"));
    assert.ok(first.body.providers.image.channels[1].models.some((model) => model.id === "gpt-image-2"));
    const firstRequestCount = providerRequests.length;
    assert.equal(firstRequestCount >= 4, true);

    const cached = await request("/api/admin/providers/models");
    assert.deepEqual(cached.body, first.body);
    assert.equal(providerRequests.length, firstRequestCount + 1);

    const refreshed = await request("/api/admin/providers/models?refresh=1");
    assert.equal(refreshed.response.status, 200);
    assert.equal(refreshed.body.providers.vision.status, "ok");
    assert.equal(providerRequests.length > firstRequestCount + 1, true);
  } finally {
    await new Promise((resolveClose) => providerServer.close(resolveClose));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("project deletion removes only the selected project and its uploads", async () => {
  const first = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Delete me" })
  });
  const second = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Keep me" })
  });
  const firstId = first.body.project.id;
  const secondId = second.body.project.id;

  const uploaded = await request(`/api/projects/${firstId}/assets`, {
    method: "POST",
    body: JSON.stringify({
      files: [{ name: "shoe.png", dataUrl: tinyPng }]
    })
  });
  const storedName = uploaded.body.project.assets[0].storedName;
  const uploadedPath = join(dataRoot, "uploads", firstId, storedName);
  await access(uploadedPath);

  const deleted = await request(`/api/projects/${firstId}`, { method: "DELETE" });
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.body.deletedProjectId, firstId);
  assert.equal(await repository.readProject(firstId), null);
  await assert.rejects(access(uploadedPath));

  const kept = await request(`/api/projects/${secondId}`);
  assert.equal(kept.response.status, 200);
  assert.equal(kept.body.project.name, "Keep me");

  const missing = await request(`/api/projects/${firstId}`, { method: "DELETE" });
  assert.equal(missing.response.status, 404);
});

test("batch project deletion removes only the selected projects", async () => {
  const first = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Batch delete A" })
  });
  const second = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Batch delete B" })
  });
  const third = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Batch delete C" })
  });

  const response = await request("/api/projects", {
    method: "DELETE",
    body: JSON.stringify({
      projectIds: [first.body.project.id, third.body.project.id]
    })
  });

  assert.equal(response.response.status, 200);
  assert.deepEqual(response.body.deletedProjectIds.sort(), [
    first.body.project.id,
    third.body.project.id
  ].sort());
  assert.deepEqual(response.body.missingProjectIds, []);
  assert.equal(await repository.readProject(first.body.project.id), null);
  assert.equal(await repository.readProject(third.body.project.id), null);

  const remaining = await request(`/api/projects/${second.body.project.id}`);
  assert.equal(remaining.response.status, 200);
  assert.equal(remaining.body.project.name, "Batch delete B");
});

test("asset deletion removes the only uploaded image before analysis", async () => {
  const created = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Asset cleanup" })
  });
  const projectId = created.body.project.id;
  const uploaded = await request(`/api/projects/${projectId}/assets`, {
    method: "POST",
    body: JSON.stringify({
      files: [{ name: "shoe-collage.png", dataUrl: tinyPng }]
    })
  });
  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.body.project.assets.length, 1);
  const asset = uploaded.body.project.assets[0];
  assert.ok(asset.uploadedAt);
  const uploadedPath = join(dataRoot, "uploads", projectId, asset.storedName);
  await access(uploadedPath);

  const removed = await request(`/api/projects/${projectId}/assets/${asset.id}`, {
    method: "DELETE"
  });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.project.assets.length, 0);
  await assert.rejects(access(uploadedPath));
});

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

before(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "shoe-ad-studio-settings-"));
  envPath = join(dataRoot, ".env");
  process.env.STUDIO_DATA_ROOT = dataRoot;
  process.env.STUDIO_ENV_PATH = envPath;
  delete process.env.VISION_MODEL_API_KEY;
  delete process.env.TEXT_MODEL_API_KEY;
  delete process.env.IMAGE_MODEL_API_KEY;

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

test("provider settings persist locally without returning API keys", async () => {
  const initial = await request("/api/settings/providers");
  assert.equal(initial.response.status, 200);
  assert.equal(initial.body.providers.vision.configured, false);
  assert.equal(initial.body.providers.text.configured, false);
  assert.equal(initial.body.providers.image.configured, false);

  const updated = await request("/api/settings/providers", {
    method: "PUT",
    body: JSON.stringify({
      visionApiKey: "vision-secret",
      deepSeekApiKey: "deepseek-secret",
      imageApiKey: "image-secret"
    })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.providers.vision.configured, true);
  assert.equal(updated.body.providers.text.configured, true);
  assert.equal(updated.body.providers.image.configured, true);
  assert.equal(JSON.stringify(updated.body).includes("secret"), false);
  assert.equal(updated.body.providers.image.role, "生图 Key");
  assert.equal(updated.body.providers.image.channel, "画图 (/draw)");
  assert.equal(updated.body.providers.image.keyPreview, "已保存 · 末尾 cret");

  let stored = await readFile(envPath, "utf8");
  assert.match(stored, /VISION_MODEL_API_KEY=vision-secret/);
  assert.match(stored, /IMAGE_MODEL_API_KEY=image-secret/);
  assert.match(stored, /TEXT_MODEL_API_KEY=deepseek-secret/);

  const visionUpdated = await request("/api/settings/providers", {
    method: "PUT",
    body: JSON.stringify({ visionApiKey: "new-vision-secret" })
  });
  assert.equal(visionUpdated.body.providers.vision.configured, true);
  assert.equal(visionUpdated.body.providers.text.configured, true);
  assert.equal(visionUpdated.body.providers.image.configured, true);
  stored = await readFile(envPath, "utf8");
  assert.match(stored, /VISION_MODEL_API_KEY=new-vision-secret/);
  assert.match(stored, /IMAGE_MODEL_API_KEY=image-secret/);

  const independentKeysUpdated = await request("/api/settings/providers", {
    method: "PUT",
    body: JSON.stringify({
      visionApiKey: "independent-vision-key",
      imageApiKey: "independent-image-key"
    })
  });
  assert.equal(independentKeysUpdated.response.status, 200);
  stored = await readFile(envPath, "utf8");
  assert.match(stored, /VISION_MODEL_API_KEY=independent-vision-key/);
  assert.match(stored, /IMAGE_MODEL_API_KEY=independent-image-key/);

  const visionCleared = await request("/api/settings/providers", {
    method: "PUT",
    body: JSON.stringify({ visionApiKey: null })
  });
  assert.equal(visionCleared.body.providers.vision.configured, false);
  assert.equal(visionCleared.body.providers.text.configured, true);
  assert.equal(visionCleared.body.providers.image.configured, true);

  const allCleared = await request("/api/settings/providers", {
    method: "PUT",
    body: JSON.stringify({
      visionApiKey: null,
      deepSeekApiKey: null,
      imageApiKey: null
    })
  });
  assert.equal(allCleared.body.providers.vision.configured, false);
  assert.equal(allCleared.body.providers.text.configured, false);
  assert.equal(allCleared.body.providers.image.configured, false);
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

test("asset deletion removes one uploaded image before analysis", async () => {
  const created = await request("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "Asset cleanup" })
  });
  const projectId = created.body.project.id;
  const uploaded = await request(`/api/projects/${projectId}/assets`, {
    method: "POST",
    body: JSON.stringify({
      files: [
        { name: "shoe-a.png", dataUrl: tinyPng },
        { name: "shoe-b.png", dataUrl: tinyPng.replace("AScY42Y", "AScY42Y") }
      ]
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

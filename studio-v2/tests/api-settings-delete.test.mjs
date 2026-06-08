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
      rightCodesApiKey: "right-codes-secret",
      deepSeekApiKey: "deepseek-secret"
    })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.providers.vision.configured, true);
  assert.equal(updated.body.providers.text.configured, true);
  assert.equal(updated.body.providers.image.configured, true);
  assert.equal(JSON.stringify(updated.body).includes("secret"), false);

  let stored = await readFile(envPath, "utf8");
  assert.match(stored, /VISION_MODEL_API_KEY=right-codes-secret/);
  assert.match(stored, /IMAGE_MODEL_API_KEY=right-codes-secret/);
  assert.match(stored, /TEXT_MODEL_API_KEY=deepseek-secret/);

  const legacyUpdated = await request("/api/settings/providers", {
    method: "PUT",
    body: JSON.stringify({ visionApiKey: "legacy-right-codes-secret" })
  });
  assert.equal(legacyUpdated.body.providers.vision.configured, true);
  assert.equal(legacyUpdated.body.providers.text.configured, true);
  assert.equal(legacyUpdated.body.providers.image.configured, true);
  stored = await readFile(envPath, "utf8");
  assert.match(stored, /VISION_MODEL_API_KEY=legacy-right-codes-secret/);
  assert.match(stored, /IMAGE_MODEL_API_KEY=legacy-right-codes-secret/);

  const conflictingLegacyFields = await request("/api/settings/providers", {
    method: "PUT",
    body: JSON.stringify({
      visionApiKey: "one-key",
      imageApiKey: "another-key"
    })
  });
  assert.equal(conflictingLegacyFields.response.status, 400);
  assert.equal(conflictingLegacyFields.body.code, "INVALID_PROVIDER_SETTINGS");

  const cleared = await request("/api/settings/providers", {
    method: "PUT",
    body: JSON.stringify({
      rightCodesApiKey: null
    })
  });
  assert.equal(cleared.body.providers.vision.configured, false);
  assert.equal(cleared.body.providers.text.configured, true);
  assert.equal(cleared.body.providers.image.configured, false);

  const allCleared = await request("/api/settings/providers", {
    method: "PUT",
    body: JSON.stringify({
      deepSeekApiKey: null
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

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

let dataRoot;
let repository;

before(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "shoe-ad-studio-storage-"));
  process.env.STUDIO_DATA_ROOT = dataRoot;

  repository = await import("../src/storage/project-repository.mjs");
  await repository.initializeStorage();
});

after(async () => {
  const resolvedTemp = resolve(tmpdir());
  const resolvedData = resolve(dataRoot);
  const pathFromTemp = relative(resolvedTemp, resolvedData);
  if (!pathFromTemp.startsWith("..") && pathFromTemp.startsWith("shoe-ad-studio-storage-")) {
    await rm(resolvedData, { recursive: true, force: true });
  }
});

test("listProjects skips unreadable project files", async () => {
  const now = new Date().toISOString();
  await repository.saveProject({
    id: "valid-project",
    name: "Valid Project",
    targetCountry: "Thailand",
    audience: "日常运动与通勤人群",
    status: "assets",
    createdAt: now,
    updatedAt: now,
    assets: [],
    visionAnalysis: null,
    reviewConfirmedAt: null,
    marketBrief: null,
    marketConfirmedAt: null,
    planningPackage: null,
    scriptGeneratedAt: null,
    scriptConfirmedAt: null,
    imagePackage: null,
    manualOmniPackages: [],
    visualGeneratedAt: null
  });
  await writeFile(join(dataRoot, "projects", "broken.json"), "{not-json", "utf8");

  const originalConsoleError = console.error;
  const loggedErrors = [];
  console.error = (...args) => loggedErrors.push(args);
  try {
    const projects = await repository.listProjects();
    assert.equal(projects.length, 1);
    assert.equal(projects[0].id, "valid-project");
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(loggedErrors.length, 1);
  assert.match(String(loggedErrors[0][0]), /Skipping unreadable project file: broken\.json/);
});

test("saveProject rejects malformed project records", async () => {
  await assert.rejects(
    () => repository.saveProject({
      id: "malformed-project",
      name: "Malformed Project",
      targetCountry: "Thailand",
      audience: "日常运动与通勤人群",
      status: "missing-stage",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assets: []
    }),
    /invalid status/
  );
});

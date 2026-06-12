import test from "node:test";
import assert from "node:assert/strict";

import { buildExportPackage, getExportReadiness } from "../src/workflow-domain/export-package.mjs";
import {
  completeVisualGeneration,
  generateVisualPackage,
  recordVisualGenerationFailure
} from "../src/workflow-domain/visual-package.mjs";

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

function baseProject(id, workflowMode) {
  return {
    id,
    name: "Project",
    workflowMode,
    status: "visual",
    targetCountry: "Thailand",
    audience: "Audience",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    assets: [],
    visionAnalysis: {},
    marketBrief: {
      outputAspectRatio: "4:5",
      videoDurationSeconds: 12
    },
    scriptConfirmedAt: "2026-06-06T00:00:00.000Z",
    planningPackage: {
      workflow_mode: workflowMode,
      product_lock_manifest: {
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      }
    }
  };
}

function singleProject(id = "single-project") {
  const project = baseProject(id, "single_video");
  project.planningPackage.script_video = {
    total_duration_sec: 12,
    segment_full: {
      segment_id: "full",
      theme: "Full story",
      duration_sec: 12,
      shots: [shot(0, 12, "full")]
    }
  };
  return project;
}

function dualProject(id = "dual-project") {
  const project = baseProject(id, "legacy_multi_segment");
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
  return project;
}

test("single mode creates one full storyboard sheet with selected-aspect internal frames", () => {
  const project = singleProject();
  generateVisualPackage(project);

  assert.equal(project.imagePackage.storyboard_plan.total_images, 1);
  assert.equal(project.imagePackage.image_generation.length, 1);
  const item = project.imagePackage.image_generation[0];
  assert.equal(item.segment_id, "full");
  assert.equal(item.duration_sec, 12);
  assert.equal(item.aspect_ratio, "4:5");
  assert.equal(item.storyboard_sheet.aspect_ratio, "3:2");
  assert.match(item.prompt, /complete 0-12s shoe ad timeline/);
  assert.match(item.prompt, /internal shot thumbnail\/panel must be composed as a 4:5 video frame/);
});

test("dual 20-second mode creates two segment storyboards", () => {
  const project = dualProject();
  generateVisualPackage(project);

  assert.equal(project.imagePackage.storyboard_plan.total_images, 2);
  assert.deepEqual(
    project.imagePackage.image_generation.map((item) => item.segment_id),
    ["0-10s", "10-20s"]
  );
  assert.deepEqual(
    project.imagePackage.image_generation.map((item) => item.duration_sec),
    [10, 10]
  );
  assert.match(project.imagePackage.image_generation[0].prompt, /ONLY the 0-10s/);
  assert.match(project.imagePackage.image_generation[1].prompt, /ONLY the 10-20s/);
});

test("readiness and export require the storyboard shape selected by workflow mode", () => {
  const single = singleProject("ready-single");
  generateVisualPackage(single);
  single.imagePackage.image_generation[0].status = "done";
  single.imagePackage.image_generation[0].generated_image = {
    url: "/uploads/ready-single/full.png"
  };
  completeVisualGeneration(single);
  assert.equal(getExportReadiness(single).ready, true);
  assert.equal(buildExportPackage(single).storyboardDeliverables.length, 1);

  const dual = dualProject("ready-dual");
  generateVisualPackage(dual);
  dual.imagePackage.image_generation.forEach((item, index) => {
    item.status = "done";
    item.generated_image = { url: `/uploads/ready-dual/${index}.png` };
  });
  completeVisualGeneration(dual);
  assert.equal(getExportReadiness(dual).ready, true);
  assert.equal(buildExportPackage(dual).storyboardDeliverables.length, 2);
});

test("storyboard records from the other mode do not satisfy readiness", () => {
  const single = singleProject("mismatch-single");
  single.status = "export";
  single.imagePackage = {
    image_generation: [
      {
        segment_id: "0-10s",
        type: "storyboard_board",
        status: "done",
        aspect_ratio: "4:5",
        generated_image: { url: "/uploads/mismatch-single/a.png" }
      },
      {
        segment_id: "10-20s",
        type: "storyboard_board",
        status: "done",
        aspect_ratio: "4:5",
        generated_image: { url: "/uploads/mismatch-single/b.png" }
      }
    ]
  };
  assert.equal(getExportReadiness(single).reason, "storyboard_count");

  const dual = dualProject("mismatch-dual");
  dual.status = "export";
  dual.imagePackage = {
    image_generation: [{
      segment_id: "full",
      type: "storyboard_board",
      status: "done",
      aspect_ratio: "4:5",
      generated_image: { url: "/uploads/mismatch-dual/full.png" }
    }]
  };
  assert.equal(getExportReadiness(dual).reason, "storyboard_count");
});

test("visual generation failures retain safe provider state", () => {
  const project = singleProject("failure-project");
  recordVisualGenerationFailure(
    project,
    Object.assign(new Error("provider timeout"), {
      code: "IMAGE_PROVIDER_TIMEOUT",
      possiblyBilled: true,
      retryable: true,
      providerStatus: 524
    }),
    "2026-06-06T04:00:00.000Z"
  );

  assert.deepEqual(project.visualGenerationFailure, {
    code: "IMAGE_PROVIDER_TIMEOUT",
    message: "provider timeout",
    failedAt: "2026-06-06T04:00:00.000Z",
    possiblyBilled: true,
    retryable: true,
    providerStatus: 524
  });
});

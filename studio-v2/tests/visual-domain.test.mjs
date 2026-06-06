import test from "node:test";
import assert from "node:assert/strict";

import { buildExportPackage } from "../src/workflow-domain/export-package.mjs";
import { generateVisualPackage } from "../src/workflow-domain/visual-package.mjs";

function segment(segment_id, start) {
  return {
    segment_id,
    theme: "Test",
    duration_sec: 10,
    shots: [
      {
        start_sec: start,
        end_sec: start + 10,
        visual: "Visual",
        action: "Action",
        camera: "Camera",
        selling_point: "Point",
        localized_caption_or_vo: "Caption",
        sound: "Sound",
        transition: "Cut"
      }
    ]
  };
}

test("visual generation creates four prompts and two Omni packages", () => {
  const project = {
    id: "project-1",
    name: "Project",
    status: "visual",
    targetCountry: "Thailand",
    audience: "Audience",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    assets: [],
    visionAnalysis: {},
    marketBrief: {},
    scriptConfirmedAt: "2026-06-06T00:00:00.000Z",
    planningPackage: {
      product_lock_manifest: {
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      },
      script_20s: {
        total_duration_sec: 20,
        segment_a_0_10s: segment("0-10s", 0),
        segment_b_10_20s: segment("10-20s", 10)
      }
    }
  };

  generateVisualPackage(project, "2026-06-06T01:00:00.000Z");

  assert.equal(project.status, "export");
  assert.equal(project.imagePackage.image_generation.length, 4);
  assert.equal(project.manualOmniPackages.length, 2);
  for (const item of project.imagePackage.image_generation) {
    assert.match(item.prompt, /exact silhouette/);
    assert.match(item.prompt, /do not change color/);
  }

  const delivery = buildExportPackage(project, "2026-06-06T02:00:00.000Z");
  assert.equal(delivery.exportedAt, "2026-06-06T02:00:00.000Z");
  assert.equal(delivery.manualOmniPackages.length, 2);
});


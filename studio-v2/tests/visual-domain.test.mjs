import test from "node:test";
import assert from "node:assert/strict";

import { buildExportPackage, getExportReadiness } from "../src/workflow-domain/export-package.mjs";
import {
  completeVisualGeneration,
  generateVisualPackage,
  recordVisualGenerationFailure
} from "../src/workflow-domain/visual-package.mjs";

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

test("visual generation creates storyboard sheets with selected-aspect internal frames", () => {
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
    marketBrief: { outputAspectRatio: "4:5" },
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

  assert.equal(project.status, "visual");
  assert.equal(project.imagePackage.image_generation.length, 2);
  assert.equal(project.manualOmniPackages.length, 0);
  assert.equal(project.imagePackage.storyboard_plan.selected_aspect_ratio, "4:5");
  assert.equal(project.imagePackage.storyboard_plan.selected_frame_aspect_ratio, "4:5");
  assert.deepEqual(project.imagePackage.storyboard_plan.storyboard_sheet, {
    layout: "storyboard_sheet",
    aspect_ratio: "3:2",
    default_size: "1536x1024"
  });
  for (const item of project.imagePackage.image_generation) {
    assert.equal(item.aspect_ratio, "4:5");
    assert.deepEqual(item.storyboard_sheet, {
      layout: "storyboard_sheet",
      aspect_ratio: "3:2",
      default_size: "1536x1024"
    });
    assert.equal(item.type, "storyboard_board");
    assert.equal(item.status, "waiting");
    assert.match(item.prompt, /overall canvas is a storyboard delivery sheet/);
    assert.match(item.prompt, /internal shot thumbnail\/panel must be composed as a 4:5 video frame/);
    assert.doesNotMatch(item.prompt, /Create one 4:5 commercial storyboard board/);
    assert.match(item.prompt, /exact silhouette/);
    assert.match(item.prompt, /do not change color/);
  }

  assert.throws(() => buildExportPackage(project), {
    code: "EXPORT_NOT_READY"
  });
  project.imagePackage.image_generation.forEach((item, index) => {
    item.status = "done";
    item.generated_image = { url: `/uploads/project-1/storyboard-${index + 1}.png` };
  });
  completeVisualGeneration(project, "2026-06-06T01:30:00.000Z");
  assert.equal(project.status, "export");
  const delivery = buildExportPackage(project, "2026-06-06T02:00:00.000Z");
  assert.equal(delivery.exportedAt, "2026-06-06T02:00:00.000Z");
  assert.equal(delivery.manualOmniPackages.length, 0);
  assert.equal(delivery.storyboardDeliverables.length, 2);
});

test("visual generation can replace stale export assets", () => {
  const project = {
    id: "project-2",
    name: "Project",
    status: "export",
    targetCountry: "Thailand",
    audience: "Audience",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    assets: [],
    visionAnalysis: {},
    marketBrief: { outputAspectRatio: "9:16" },
    scriptConfirmedAt: "2026-06-06T00:00:00.000Z",
    imagePackage: {
      image_generation: [
        { segment_id: "0-10s", type: "storyboard_board", aspect_ratio: "16:9" },
        { segment_id: "0-10s", type: "video_keyframe", aspect_ratio: "9:16" },
        { segment_id: "10-20s", type: "storyboard_board", aspect_ratio: "16:9" },
        { segment_id: "10-20s", type: "video_keyframe", aspect_ratio: "9:16" }
      ]
    },
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

  generateVisualPackage(project, "2026-06-06T03:00:00.000Z");

  assert.equal(project.status, "visual");
  assert.equal(project.imagePackage.image_generation.length, 2);
  assert.deepEqual(
    project.imagePackage.image_generation.map((item) => item.aspect_ratio),
    ["9:16", "9:16"]
  );
  assert.deepEqual(
    project.imagePackage.image_generation.map((item) => item.type),
    ["storyboard_board", "storyboard_board"]
  );
  project.imagePackage.image_generation.forEach((item, index) => {
    item.status = "done";
    item.generated_image = { url: `/uploads/project-2/storyboard-${index + 1}.png` };
  });
  completeVisualGeneration(project, "2026-06-06T03:30:00.000Z");
  assert.equal(project.status, "export");
});

test("legacy export-era packages are treated as not ready until the current storyboard shape exists", () => {
  const project = {
    id: "project-3",
    name: "Project",
    status: "export",
    targetCountry: "Thailand",
    audience: "Audience",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    assets: [],
    visionAnalysis: {},
    marketBrief: { outputAspectRatio: "4:5" },
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
    },
    imagePackage: {
      image_generation: [
        { segment_id: "0-10s", type: "storyboard_board", aspect_ratio: "16:9" },
        { segment_id: "0-10s", type: "video_keyframe", aspect_ratio: "9:16" },
        { segment_id: "10-20s", type: "storyboard_board", aspect_ratio: "16:9" },
        { segment_id: "10-20s", type: "video_keyframe", aspect_ratio: "9:16" }
      ]
    }
  };

  const readiness = getExportReadiness(project);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.code, "EXPORT_NOT_READY");
  assert.equal(readiness.reason, "storyboard_count");
  assert.throws(() => buildExportPackage(project), {
    code: "EXPORT_NOT_READY"
  });
});

test("export readiness requires two completed storyboard image URLs", () => {
  const project = {
    id: "project-4",
    name: "Project",
    status: "export",
    targetCountry: "Thailand",
    audience: "Audience",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    assets: [],
    visionAnalysis: {},
    marketBrief: { outputAspectRatio: "4:5" },
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
    },
    imagePackage: {
      image_generation: [
        {
          segment_id: "0-10s",
          type: "storyboard_board",
          status: "done",
          aspect_ratio: "4:5",
          generated_image: { url: "/uploads/project-4/storyboard-1.png" }
        },
        {
          segment_id: "10-20s",
          type: "storyboard_board",
          status: "failed",
          aspect_ratio: "4:5",
          error: {
            code: "IMAGE_PROVIDER_OVERLOADED",
            message: "Right Code image model call failed: excessive system load",
            retryable: true
          }
        }
      ]
    }
  };

  const readiness = getExportReadiness(project);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.code, "EXPORT_NOT_READY");
  assert.equal(readiness.reason, "storyboard_image");
  assert.throws(() => buildExportPackage(project), {
    code: "EXPORT_NOT_READY"
  });
});

test("visual generation failures are recorded when provider calls time out", () => {
  const project = {
    id: "project-5",
    name: "Project",
    status: "visual",
    targetCountry: "Thailand",
    audience: "Audience",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    assets: [],
    visionAnalysis: {},
    marketBrief: { outputAspectRatio: "4:5" },
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

  recordVisualGenerationFailure(
    project,
    Object.assign(new Error("Right Code 图片模型请求超时。"), {
      code: "IMAGE_PROVIDER_TIMEOUT",
      possiblyBilled: true,
      retryable: true,
      providerStatus: 504
    }),
    "2026-06-06T04:00:00.000Z"
  );

  assert.equal(project.status, "visual");
  assert.equal(project.visualGeneratedAt, null);
  assert.deepEqual(project.visualGenerationFailure, {
    code: "IMAGE_PROVIDER_TIMEOUT",
    message: "Right Code 图片模型请求超时。",
    failedAt: "2026-06-06T04:00:00.000Z",
    possiblyBilled: true,
    retryable: true,
    providerStatus: 504
  });
});

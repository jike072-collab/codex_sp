import test from "node:test";
import assert from "node:assert/strict";

import {
  confirmMarketBrief,
  normalizeMarketBrief
} from "../src/workflow-domain/market-brief.mjs";
import {
  assertProjectStage,
  transitionProject
} from "../src/workflow-domain/project-workflow.mjs";
import { generateDemoPlanningPackage } from "../src/workflow-domain/demo-script.mjs";
import { normalizeConfirmedPlanningPackage } from "../src/workflow-domain/script-review.mjs";

const validBrief = {
  targetCountry: " Thailand ",
  audience: " 日常运动与通勤人群 ",
  creativeTheme: "city-motion",
  coreMessage: " 轻快、稳定，适合每天出发 ",
  tone: "energetic",
  outputAspectRatio: "9:16"
};

test("normalizeMarketBrief trims and preserves the documented contract", () => {
  assert.deepEqual(normalizeMarketBrief(validBrief), {
    targetCountry: "Thailand",
    audience: "日常运动与通勤人群",
    creativeTheme: "city-motion",
    coreMessage: "轻快、稳定，适合每天出发",
    tone: "energetic",
    outputAspectRatio: "9:16",
    videoDurationSeconds: 10
  });
});

test("normalizeMarketBrief rejects unsupported enum values", () => {
  assert.throws(
    () => normalizeMarketBrief({ ...validBrief, creativeTheme: "invented-theme" }),
    (error) => error.code === "INVALID_MARKET_BRIEF" && error.statusCode === 400
  );
});

test("project transitions allow only the documented next stage", () => {
  const project = { status: "market" };
  transitionProject(project, "script");
  assert.equal(project.status, "script");
  assert.throws(
    () => transitionProject(project, "export"),
    (error) => error.code === "INVALID_STAGE_TRANSITION"
  );
});

test("assertProjectStage rejects operations at the wrong review gate", () => {
  assert.throws(
    () => assertProjectStage({ status: "assets" }, "market", "保存市场创意"),
    (error) => error.code === "INVALID_PROJECT_STAGE"
  );
});

test("confirmMarketBrief persists the brief and advances to script", () => {
  const project = {
    status: "market",
    targetCountry: "Vietnam",
    audience: "old audience",
    visionAnalysis: { product_summary: { shoe_type: "running shoe" } },
    reviewConfirmedAt: "2026-06-06T00:00:00.000Z"
  };

  confirmMarketBrief(project, validBrief, "2026-06-06T01:00:00.000Z");

  assert.equal(project.status, "script");
  assert.equal(project.targetCountry, "Thailand");
  assert.equal(project.audience, "日常运动与通勤人群");
  assert.equal(project.marketBrief.creativeTheme, "city-motion");
  assert.equal(project.marketBrief.videoDurationSeconds, 10);
  assert.equal(project.marketConfirmedAt, "2026-06-06T01:00:00.000Z");
});

test("confirmMarketBrief requires a confirmed product review", () => {
  assert.throws(
    () => confirmMarketBrief({ status: "market" }, validBrief),
    (error) => error.code === "PRODUCT_REVIEW_REQUIRED"
  );
});

test("script confirmation cannot drop confirmed product lock rules", () => {
  const project = {
    status: "script",
    reviewConfirmedAt: "2026-06-06T00:00:00.000Z",
    marketConfirmedAt: "2026-06-06T00:30:00.000Z",
    marketBrief: validBrief,
    visionAnalysis: {
      product_lock_manifest: {
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      },
      visible_selling_point_candidates: []
    }
  };
  const planning = generateDemoPlanningPackage(project);
  assert.equal(planning.script_20s.segment_a_0_10s.shots.length, 5);
  assert.equal(planning.script_20s.segment_b_10_20s.shots.length, 5);
  planning.product_lock_manifest.must_keep = [];

  assert.throws(
    () => normalizeConfirmedPlanningPackage(
      planning,
      project.visionAnalysis.product_lock_manifest
    ),
    (error) => error.code === "INVALID_SCRIPT"
  );

  const planningWithoutMustNotChange = generateDemoPlanningPackage(project);
  planningWithoutMustNotChange.product_lock_manifest.must_not_change = [];

  assert.throws(
    () => normalizeConfirmedPlanningPackage(
      planningWithoutMustNotChange,
      project.visionAnalysis.product_lock_manifest
    ),
    (error) => error.code === "INVALID_SCRIPT"
  );
});

test("script confirmation rejects exact duplicate shot content across legacy segments", () => {
  const project = {
    status: "script",
    reviewConfirmedAt: "2026-06-06T00:00:00.000Z",
    marketConfirmedAt: "2026-06-06T00:30:00.000Z",
    marketBrief: validBrief,
    visionAnalysis: {
      product_lock_manifest: {
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      },
      visible_selling_point_candidates: []
    }
  };
  const planning = generateDemoPlanningPackage(project);
  const first = planning.script_20s.segment_a_0_10s.shots[0];
  const repeated = planning.script_20s.segment_b_10_20s.shots[0];
  repeated.visual = first.visual;
  repeated.action = first.action;
  repeated.camera = first.camera;

  assert.throws(
    () => normalizeConfirmedPlanningPackage(
      planning,
      project.visionAnalysis.product_lock_manifest
    ),
    (error) => (
      error.code === "INVALID_SCRIPT"
      && /镜头内容重复，请重新生成脚本/.test(error.message)
    )
  );
});

test("script confirmation rejects majority template reuse across major shot fields", () => {
  const project = {
    status: "script",
    reviewConfirmedAt: "2026-06-06T00:00:00.000Z",
    marketConfirmedAt: "2026-06-06T00:30:00.000Z",
    marketBrief: validBrief,
    visionAnalysis: {
      product_lock_manifest: {
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      },
      visible_selling_point_candidates: []
    }
  };
  const planning = generateDemoPlanningPackage(project);
  const shots = [
    ...planning.script_20s.segment_a_0_10s.shots,
    ...planning.script_20s.segment_b_10_20s.shots
  ];
  shots.slice(0, 6).forEach((entry, index) => {
    entry.visual = "Same product pose template";
    entry.action = "Same product motion template";
    entry.camera = `Distinct camera ${index}`;
  });

  assert.throws(
    () => normalizeConfirmedPlanningPackage(
      planning,
      project.visionAnalysis.product_lock_manifest
    ),
    (error) => (
      error.code === "INVALID_SCRIPT"
      && /镜头内容重复，请重新生成脚本/.test(error.message)
    )
  );
});

test("15-second demo mode creates eight distinct shots instead of repeating the final template", () => {
  const project = {
    status: "script",
    workflowMode: "single_video",
    reviewConfirmedAt: "2026-06-06T00:00:00.000Z",
    marketConfirmedAt: "2026-06-06T00:30:00.000Z",
    marketBrief: {
      ...validBrief,
      videoDurationSeconds: 15
    },
    visionAnalysis: {
      product_lock_manifest: {
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      },
      visible_selling_point_candidates: []
    }
  };

  const planning = generateDemoPlanningPackage(project);
  const shots = planning.script_video.segment_full.shots;
  const signatures = shots.map((entry) => (
    `${entry.visual}|${entry.action}|${entry.camera}`
  ));

  assert.equal(shots.length, 8);
  assert.equal(new Set(signatures).size, 8);
  assert.equal(shots[0].start_sec, 0);
  assert.equal(shots.at(-1).end_sec, 15);
  assert.doesNotThrow(() => normalizeConfirmedPlanningPackage(
    planning,
    project.visionAnalysis.product_lock_manifest,
    { workflowMode: "single_video", videoDurationSeconds: 15 }
  ));
});

test("single mode rejects duplicate shot signatures", () => {
  const project = {
    status: "script",
    workflowMode: "single_video",
    reviewConfirmedAt: "2026-06-06T00:00:00.000Z",
    marketConfirmedAt: "2026-06-06T00:30:00.000Z",
    marketBrief: {
      ...validBrief,
      videoDurationSeconds: 10
    },
    visionAnalysis: {
      product_lock_manifest: {
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      },
      visible_selling_point_candidates: []
    }
  };
  const planning = generateDemoPlanningPackage(project);
  const [first, second] = planning.script_video.segment_full.shots;
  second.visual = first.visual;
  second.action = first.action;
  second.camera = first.camera;

  assert.throws(
    () => normalizeConfirmedPlanningPackage(
      planning,
      project.visionAnalysis.product_lock_manifest,
      { workflowMode: "single_video", videoDurationSeconds: 10 }
    ),
    (error) => error.code === "INVALID_SCRIPT" && /镜头内容重复/.test(error.message)
  );
});

test("distinct and contiguous dual-mode shots pass normalization", () => {
  const project = {
    status: "script",
    workflowMode: "legacy_multi_segment",
    reviewConfirmedAt: "2026-06-06T00:00:00.000Z",
    marketConfirmedAt: "2026-06-06T00:30:00.000Z",
    marketBrief: validBrief,
    visionAnalysis: {
      product_lock_manifest: {
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      },
      visible_selling_point_candidates: []
    }
  };
  const planning = generateDemoPlanningPackage(project);

  assert.doesNotThrow(() => normalizeConfirmedPlanningPackage(
    planning,
    project.visionAnalysis.product_lock_manifest,
    { workflowMode: "legacy_multi_segment" }
  ));
});

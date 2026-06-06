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
  tone: "energetic"
};

test("normalizeMarketBrief trims and preserves the documented contract", () => {
  assert.deepEqual(normalizeMarketBrief(validBrief), {
    targetCountry: "Thailand",
    audience: "日常运动与通勤人群",
    creativeTheme: "city-motion",
    coreMessage: "轻快、稳定，适合每天出发",
    tone: "energetic"
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
  planning.product_lock_manifest.must_keep = [];

  assert.throws(
    () => normalizeConfirmedPlanningPackage(
      planning,
      project.visionAnalysis.product_lock_manifest
    ),
    (error) => error.code === "INVALID_SCRIPT"
  );
});

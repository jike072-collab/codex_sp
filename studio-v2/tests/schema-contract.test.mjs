import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schemaUrl = new URL("../../schemas/shoe-ad-package.schema.json", import.meta.url);
const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

function branchMatches(branch, value) {
  if (!(branch.required || []).every((field) => Object.hasOwn(value, field))) {
    return false;
  }
  for (const [field, rule] of Object.entries(branch.properties || {})) {
    if (Object.hasOwn(rule, "const") && value[field] !== rule.const) {
      return false;
    }
  }
  if ((branch.not?.required || []).every((field) => Object.hasOwn(value, field))) {
    return false;
  }
  return true;
}

function matchesExactlyOneScriptShape(value) {
  return schema.oneOf.filter((branch) => branchMatches(branch, value)).length === 1;
}

test("shoe ad package schema accepts each workflow mode's matching script shape", () => {
  assert.equal(matchesExactlyOneScriptShape({
    workflow_mode: "single_video",
    script_video: {}
  }), true);
  assert.equal(matchesExactlyOneScriptShape({
    workflow_mode: "legacy_multi_segment",
    script_20s: {}
  }), true);
});

test("shoe ad package schema rejects mixed single and dual script fields", () => {
  assert.equal(matchesExactlyOneScriptShape({
    workflow_mode: "single_video",
    script_video: {},
    script_20s: {}
  }), false);
  assert.equal(matchesExactlyOneScriptShape({
    workflow_mode: "legacy_multi_segment",
    script_20s: {},
    script_video: {}
  }), false);
});

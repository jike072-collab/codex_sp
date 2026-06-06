import test from "node:test";
import assert from "node:assert/strict";

import { analyzeProject } from "../src/ai-providers/vision-provider.mjs";
import { generateProjectScript } from "../src/ai-providers/text-provider.mjs";
import { generateProjectVisuals } from "../src/ai-providers/image-provider.mjs";
import {
  generateDemoPlanningPackage,
  generateProjectDemoScript
} from "../src/workflow-domain/demo-script.mjs";
import { confirmPlanningPackage } from "../src/workflow-domain/script-review.mjs";

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
  "IMAGE_MODEL_PROVIDER"
];

async function withProviderEnv(values, callback) {
  const previous = Object.fromEntries(
    providerEnvKeys.map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, values);
  try {
    return await callback();
  } finally {
    for (const key of providerEnvKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function reviewedProject() {
  return {
    id: "provider-project",
    name: "Provider project",
    status: "script",
    targetCountry: "Thailand",
    audience: "Daily commuters",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    assets: [],
    reviewConfirmedAt: "2026-06-06T00:10:00.000Z",
    marketConfirmedAt: "2026-06-06T00:20:00.000Z",
    marketBrief: {
      targetCountry: "Thailand",
      audience: "Daily commuters",
      creativeTheme: "city-motion",
      coreMessage: "Light and stable for every day",
      tone: "energetic"
    },
    visionAnalysis: {
      product_summary: {
        shoe_type: "running shoe",
        likely_usage: { value: "daily movement", evidence: "inferred" },
        overall_style: "sport"
      },
      product_lock_manifest: {
        main_colors: ["blue"],
        supporting_colors: ["white"],
        upper_material_visible: "mesh",
        toe_shape: "rounded",
        lace_system: "standard",
        midsole_shape: "curved",
        outsole_color: "black",
        outsole_pattern: "visible tread",
        side_pattern_or_logo: "side graphic",
        heel_structure: "padded",
        must_keep: ["exact silhouette"],
        must_not_change: ["do not change color"]
      },
      visible_selling_point_candidates: []
    }
  };
}

test("Right Code vision adapter sends an OpenAI-compatible multimodal request", async () => {
  await withProviderEnv({
    VISION_MODEL_API_KEY: "test-right-code-key",
    VISION_API_URL: "https://example.test/draw/v1/chat/completions",
    VISION_MODEL: "gemini-2.5-flash"
  }, async () => {
    let requestBody;
    const analysis = await analyzeProject(
      { id: "vision-project", assets: [] },
      {
        fetchImpl: async (url, options) => {
          assert.equal(url, "https://example.test/draw/v1/chat/completions");
          requestBody = JSON.parse(options.body);
          return new Response(JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify(reviewedProject().visionAnalysis)
              }
            }]
          }), { status: 200 });
        }
      }
    );

    assert.equal(requestBody.model, "gemini-2.5-flash");
    assert.equal(requestBody.stream, false);
    assert.equal(requestBody.messages[1].content[0].type, "text");
    assert.equal(analysis.mode, "api");
    assert.deepEqual(
      analysis.product_lock_manifest.must_keep,
      ["exact silhouette"]
    );
  });
});

test("DeepSeek adapter requests JSON and validates the generated 20-second script", async () => {
  await withProviderEnv({
    TEXT_MODEL_API_KEY: "test-deepseek-key",
    TEXT_API_URL: "https://api.deepseek.test/chat/completions",
    TEXT_MODEL: "deepseek-v4-pro"
  }, async () => {
    const project = reviewedProject();
    const modelOutput = generateDemoPlanningPackage(structuredClone(project));
    let requestBody;
    await generateProjectScript(project, "2026-06-06T01:00:00.000Z", {
      fetchImpl: async (url, options) => {
        assert.equal(url, "https://api.deepseek.test/chat/completions");
        requestBody = JSON.parse(options.body);
        return new Response(JSON.stringify({
          choices: [{ message: { content: JSON.stringify(modelOutput) } }]
        }), { status: 200 });
      }
    });

    assert.equal(requestBody.model, "deepseek-v4-pro");
    assert.deepEqual(requestBody.response_format, { type: "json_object" });
    assert.deepEqual(requestBody.thinking, { type: "enabled" });
    assert.equal(project.planningPackage.mode, "api");
    assert.equal(project.planningPackage.script_20s.total_duration_sec, 20);
    assert.equal(project.scriptGeneratedAt, "2026-06-06T01:00:00.000Z");
  });
});

test("Right Code image adapter generates four referenced image requests", async () => {
  await withProviderEnv({
    IMAGE_MODEL_API_KEY: "test-right-code-key",
    IMAGE_API_URL: "https://example.test/draw/v1/images/generations",
    IMAGE_MODEL: "gpt-image-2",
    IMAGE_MODEL_PROVIDER: "right_codes"
  }, async () => {
    const project = reviewedProject();
    generateProjectDemoScript(project, "2026-06-06T01:00:00.000Z");
    confirmPlanningPackage(
      project,
      structuredClone(project.planningPackage),
      "2026-06-06T01:10:00.000Z"
    );

    const requests = [];
    await generateProjectVisuals(project, "2026-06-06T01:20:00.000Z", {
      fetchImpl: async (url, options) => {
        assert.equal(url, "https://example.test/draw/v1/images/generations");
        requests.push(JSON.parse(options.body));
        return new Response(JSON.stringify({
          data: [{ url: `https://images.test/${requests.length}.png` }]
        }), { status: 200 });
      }
    });

    assert.equal(requests.length, 4);
    assert.equal(requests[0].model, "gpt-image-2");
    assert.deepEqual(requests[0].image, []);
    assert.equal(requests[0].size, "1536x1024");
    assert.equal(requests[1].size, "1024x1536");
    assert.equal(project.imagePackage.mode, "api");
    assert.equal(
      project.imagePackage.image_generation[3].generated_image.url,
      "https://images.test/4.png"
    );
  });
});

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { loadEnv, projectRoot, uploadsRoot } from "../config.mjs";
import { cleanString, normalizeList } from "../workflow-domain/value-normalizers.mjs";
import {
  extractJsonObject,
  hasUsableApiKey,
  positiveInteger,
  postProviderJson,
  ProviderError
} from "./provider-utils.mjs";

function demoAnalysis(project) {
  return {
    mode: "demo",
    product_summary: {
      shoe_type: "运动鞋（演示识别，请人工确认）",
      likely_usage: {
        value: "日常穿着或轻运动",
        evidence: "inferred"
      },
      overall_style: "现代电商运动风"
    },
    product_lock_manifest: {
      main_colors: ["请根据图片填写主色"],
      supporting_colors: [],
      upper_material_visible: "请观察鞋面纹理后填写",
      toe_shape: "保持参考图中的鞋头轮廓",
      lace_system: "保持鞋带与鞋眼布局",
      midsole_shape: "保持中底高度和侧面轮廓",
      outsole_color: "请根据图片填写",
      outsole_pattern: "保持参考图中的外底纹路",
      side_pattern_or_logo: "保持侧面图案，不生成虚假品牌标识",
      heel_structure: "保持参考图中的后跟结构",
      must_keep: [
        "鞋型轮廓与各视角参考图一致",
        "主色、辅色和拼接区域一致",
        "中底、外底与侧面图案一致"
      ],
      must_not_change: [
        "不得更换鞋款",
        "不得虚构品牌或科技标识",
        "不得改变鞋底结构"
      ]
    },
    visible_selling_point_candidates: [],
    image_quality: {
      usable: project.assets.length > 0,
      views_detected: project.assets.map((asset) => asset.name),
      missing_or_unclear: ["当前为演示识别，请人工检查正面、侧面、后跟和鞋底视角"],
      notes: ["配置视觉模型 API Key 后可获得真实识别结果"]
    }
  };
}

function isDrawEndpoint(apiUrl) {
  return /\/draw(?:\/|$)/i.test(apiUrl);
}

function nativeGeminiUrl(apiUrl, model) {
  if (/:generateContent(?:\?|$)/i.test(apiUrl)) return apiUrl;
  return `${apiUrl.replace(/\/+$/, "")}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

export async function analyzeProject(project, { fetchImpl = fetch } = {}) {
  const env = await loadEnv();
  const key = env.VISION_MODEL_API_KEY;
  const apiUrl = env.VISION_API_URL
    || "https://right.codes/gemini";
  const model = env.VISION_MODEL || "gemini-2.5-flash";

  if (!hasUsableApiKey(key)) return demoAnalysis(project);

  const systemPrompt = await readFile(
    join(projectRoot, "prompts", "00_vision_analysis.system.md"),
    "utf8"
  );
  const imageParts = await Promise.all(project.assets.map(async (asset) => {
    const bytes = await readFile(join(uploadsRoot, project.id, asset.storedName));
    return {
      mimeType: asset.mimeType,
      data: bytes.toString("base64")
    };
  }));

  let payload;
  let content;
  if (isDrawEndpoint(apiUrl)) {
    payload = await postProviderJson({
      url: apiUrl,
      apiKey: key,
      timeoutMs: positiveInteger(env.VISION_TIMEOUT_MS, 120000),
      providerLabel: "Right Code 识图模型",
      errorCode: "VISION_PROVIDER_ERROR",
      fetchImpl,
      body: {
        model,
        temperature: 0.1,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "这些图片属于同一款鞋。请综合所有视角识别产品，并严格按系统要求输出 JSON。"
              },
              ...imageParts.map((image) => ({
                type: "image_url",
                image_url: { url: `data:${image.mimeType};base64,${image.data}` }
              }))
            ]
          }
        ]
      }
    });
    content = payload?.choices?.[0]?.message?.content;
  } else {
    payload = await postProviderJson({
      url: nativeGeminiUrl(apiUrl, model),
      apiKey: key,
      headers: { "x-goog-api-key": key },
      timeoutMs: positiveInteger(env.VISION_TIMEOUT_MS, 120000),
      providerLabel: "Right Code Gemini 识图模型",
      errorCode: "VISION_PROVIDER_ERROR",
      fetchImpl,
      body: {
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          role: "user",
          parts: [
            {
              text: "这些图片属于同一款鞋。请综合所有视角识别产品，并严格按系统要求输出 JSON。"
            },
            ...imageParts.map((image) => ({
              inlineData: image
            }))
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      }
    });
    const responseParts = payload?.candidates?.[0]?.content?.parts || [];
    const answerParts = responseParts.filter(
      (part) => !part.thought && typeof part.text === "string"
    );
    content = (answerParts.length ? answerParts : responseParts)
      .map((part) => part.text)
      .filter(Boolean)
      .join("");
  }

  if (!content) {
    throw new ProviderError("Right Code 识图模型响应中没有可用内容。", {
      code: "VISION_PROVIDER_ERROR"
    });
  }
  return { mode: "api", ...extractJsonObject(content, "Right Code 识图模型") };
}

export function sanitizeAnalysis(input) {
  const summary = input?.product_summary || {};
  const usage = summary.likely_usage || {};
  const lock = input?.product_lock_manifest || {};
  const quality = input?.image_quality || {};

  return {
    mode: cleanString(input?.mode, "reviewed"),
    product_summary: {
      shoe_type: cleanString(summary.shoe_type),
      likely_usage: {
        value: cleanString(usage.value),
        evidence: cleanString(usage.evidence, "unknown")
      },
      overall_style: cleanString(summary.overall_style)
    },
    product_lock_manifest: {
      main_colors: normalizeList(lock.main_colors),
      supporting_colors: normalizeList(lock.supporting_colors),
      upper_material_visible: cleanString(lock.upper_material_visible),
      toe_shape: cleanString(lock.toe_shape),
      lace_system: cleanString(lock.lace_system),
      midsole_shape: cleanString(lock.midsole_shape),
      outsole_color: cleanString(lock.outsole_color),
      outsole_pattern: cleanString(lock.outsole_pattern),
      side_pattern_or_logo: cleanString(lock.side_pattern_or_logo),
      heel_structure: cleanString(lock.heel_structure),
      must_keep: normalizeList(lock.must_keep),
      must_not_change: normalizeList(lock.must_not_change)
    },
    visible_selling_point_candidates: Array.isArray(input?.visible_selling_point_candidates)
      ? input.visible_selling_point_candidates
      : [],
    image_quality: {
      usable: Boolean(quality.usable),
      views_detected: normalizeList(quality.views_detected),
      missing_or_unclear: normalizeList(quality.missing_or_unclear),
      notes: normalizeList(quality.notes)
    }
  };
}

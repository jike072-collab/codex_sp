import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";

import { loadEnv, localEnvPath } from "../config.mjs";
import { hasUsableApiKey } from "../ai-providers/provider-utils.mjs";
import { DomainError } from "../workflow-domain/domain-error.mjs";

function invalidSettings(message) {
  throw new DomainError(message, { code: "INVALID_PROVIDER_SETTINGS" });
}

function normalizeKeyUpdate(input, field) {
  if (!(field in input)) return undefined;
  const value = input[field];
  if (value === null) return "replace_me";
  if (typeof value !== "string") invalidSettings(`${field} 必须是字符串或 null。`);
  const trimmed = value.trim();
  if (!trimmed) invalidSettings(`${field} 不能为空；如需清除请提交 null。`);
  if (/[\r\n]/.test(trimmed)) invalidSettings(`${field} 格式无效。`);
  return trimmed;
}

function keyPreview(value) {
  const key = String(value || "").trim();
  if (!hasUsableApiKey(key)) return "";
  return `已保存 · 末尾 ${key.slice(-4)}`;
}

async function readEnvText() {
  try {
    return await readFile(localEnvPath(), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

function updateEnvText(text, updates) {
  const pending = new Map(Object.entries(updates));
  const output = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    const key = match?.[1];
    if (!key || !pending.has(key)) {
      output.push(line);
      continue;
    }
    output.push(`${key}=${pending.get(key)}`);
    pending.delete(key);
  }
  if (pending.size) {
    if (output.length && output.at(-1) !== "") output.push("");
    for (const [key, value] of pending) output.push(`${key}=${value}`);
  }
  return `${output.join("\n").replace(/\n+$/g, "")}\n`;
}

async function writeEnvAtomically(text) {
  const target = localEnvPath();
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, text, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export async function readProviderSettings() {
  const env = await loadEnv();
  return {
    providers: {
      vision: {
        provider: "Right Code",
        role: "识图 Key",
        channel: "Gemini (/gemini)",
        model: env.VISION_MODEL || "gemini-2.5-flash",
        apiUrl: env.VISION_API_URL
          || "https://right.codes/gemini",
        configured: hasUsableApiKey(env.VISION_MODEL_API_KEY),
        keyPreview: keyPreview(env.VISION_MODEL_API_KEY)
      },
      text: {
        provider: "DeepSeek",
        role: "脚本 Key",
        channel: "Chat Completions",
        model: env.TEXT_MODEL || "deepseek-v4-pro",
        apiUrl: env.TEXT_API_URL || "https://api.deepseek.com/chat/completions",
        configured: hasUsableApiKey(env.TEXT_MODEL_API_KEY),
        keyPreview: keyPreview(env.TEXT_MODEL_API_KEY)
      },
      image: {
        provider: "Right Code",
        role: "生图 Key",
        channel: "画图 (/draw)",
        model: env.IMAGE_MODEL || "gpt-image-2",
        apiUrl: env.IMAGE_API_URL
          || "https://www.right.codes/draw/v1/images/generations",
        configured: hasUsableApiKey(env.IMAGE_MODEL_API_KEY),
        keyPreview: keyPreview(env.IMAGE_MODEL_API_KEY)
      }
    }
  };
}

export async function updateProviderSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    invalidSettings("请提交有效的 API 设置对象。");
  }

  const updates = {};
  const visionApiKey = normalizeKeyUpdate(input, "visionApiKey");
  const imageApiKey = normalizeKeyUpdate(input, "imageApiKey");

  if (visionApiKey !== undefined) {
    updates.VISION_MODEL_API_KEY = visionApiKey;
  }
  if (imageApiKey !== undefined) {
    updates.IMAGE_MODEL_API_KEY = imageApiKey;
  }

  const deepSeekApiKey = normalizeKeyUpdate(input, "deepSeekApiKey");
  if (deepSeekApiKey !== undefined) {
    updates.TEXT_MODEL_API_KEY = deepSeekApiKey;
  }

  if (Object.keys(updates).length) {
    const current = await readEnvText();
    await writeEnvAtomically(updateEnvText(current, updates));
  }
  return readProviderSettings();
}

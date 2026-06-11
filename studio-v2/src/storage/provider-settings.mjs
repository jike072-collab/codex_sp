import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";

import { loadEnv, localEnvPath } from "../config.mjs";
import { hasUsableApiKey } from "../ai-providers/provider-utils.mjs";
import { DomainError } from "../workflow-domain/domain-error.mjs";

export const PROVIDER_SETTINGS_SCHEMA_VERSION = 1;

const PROVIDER_DEFINITIONS = Object.freeze([
  {
    id: "vision",
    title: "识图模型",
    provider: "Right Code",
    role: "商品识别与产品锁定",
    channel: "Gemini 识图通道",
    fields: [
      {
        name: "apiUrl",
        label: "API 地址",
        type: "url",
        valueKey: "visionApiUrl",
        clearable: false,
        envKey: "VISION_API_URL",
        defaultValue: "https://right.codes/gemini"
      },
      {
        name: "model",
        label: "模型",
        type: "select",
        valueKey: "visionModel",
        clearable: false,
        envKey: "VISION_MODEL",
        defaultValue: "gemini-2.5-flash"
      },
      {
        name: "apiKey",
        label: "API Key",
        type: "secret",
        valueKey: "visionApiKey",
        clearable: true,
        envKey: "VISION_MODEL_API_KEY"
      }
    ]
  },
  {
    id: "text",
    title: "脚本模型",
    provider: "DeepSeek",
    role: "本地化 20 秒广告脚本生成",
    channel: "Chat Completions 对话通道",
    fields: [
      {
        name: "apiUrl",
        label: "API 地址",
        type: "url",
        valueKey: "textApiUrl",
        clearable: false,
        envKey: "TEXT_API_URL",
        defaultValue: "https://api.deepseek.com/chat/completions"
      },
      {
        name: "model",
        label: "模型",
        type: "select",
        valueKey: "textModel",
        clearable: false,
        envKey: "TEXT_MODEL",
        defaultValue: "deepseek-v4-pro"
      },
      {
        name: "apiKey",
        label: "API Key",
        type: "secret",
        valueKey: "deepSeekApiKey",
        clearable: true,
        envKey: "TEXT_MODEL_API_KEY"
      }
    ]
  },
  {
    id: "image",
    title: "故事板图片模型",
    provider: "Right Code",
    role: "img2img 故事板生成",
    channel: "Draw 画图通道",
    fields: [
      {
        name: "apiUrl",
        label: "API 地址",
        type: "url",
        valueKey: "imageApiUrl",
        clearable: false,
        envKey: "IMAGE_API_URL",
        defaultValue: "https://www.right.codes/draw/v1/images/generations"
      },
      {
        name: "model",
        label: "模型",
        type: "select",
        valueKey: "imageModel",
        clearable: false,
        envKey: "IMAGE_MODEL",
        defaultValue: "gpt-image-2"
      },
      {
        name: "apiKey",
        label: "API Key",
        type: "secret",
        valueKey: "imageApiKey",
        clearable: true,
        envKey: "IMAGE_MODEL_API_KEY"
      }
    ]
  }
]);

const FIELD_BY_VALUE_KEY = new Map(
  PROVIDER_DEFINITIONS.flatMap((provider) => provider.fields.map((field) => [
    field.valueKey,
    { provider, field }
  ]))
);

function invalidSettings(message) {
  throw new DomainError(message, {
    code: "INVALID_PROVIDER_SETTINGS",
    statusCode: 400
  });
}

function fieldValue(env, field) {
  return env[field.envKey] || field.defaultValue || "";
}

function keyPreview(value) {
  const key = String(value || "").trim();
  if (!hasUsableApiKey(key)) return "";
  return `•••• ${key.slice(-4)}`;
}

function sanitizeProviderDefinition(provider, env) {
  const modelField = provider.fields.find((field) => field.name === "model");
  const urlField = provider.fields.find((field) => field.name === "apiUrl");
  const keyField = provider.fields.find((field) => field.name === "apiKey");
  const apiKey = keyField ? env[keyField.envKey] : "";

  return {
    id: provider.id,
    title: provider.title,
    provider: provider.provider,
    role: provider.role,
    channel: provider.channel,
    fields: provider.fields.map(({ envKey, defaultValue, ...field }) => field),
    config: {
      model: modelField ? fieldValue(env, modelField) : "",
      apiUrl: urlField ? fieldValue(env, urlField) : "",
      configured: hasUsableApiKey(apiKey),
      keyPreview: keyPreview(apiKey)
    }
  };
}

function configuredProviders(env) {
  return PROVIDER_DEFINITIONS.map((provider) => {
    const keyField = provider.fields.find((field) => field.name === "apiKey");
    return {
      id: provider.id,
      configured: hasUsableApiKey(keyField ? env[keyField.envKey] : "")
    };
  });
}

function normalizeTextUpdate(input, valueKey) {
  if (!(valueKey in input)) return undefined;
  const value = input[valueKey];
  if (typeof value !== "string") invalidSettings(`${valueKey} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) invalidSettings(`${valueKey} cannot be empty.`);
  if (/[\r\n]/.test(trimmed)) invalidSettings(`${valueKey} cannot contain line breaks.`);
  return trimmed;
}

function normalizeUrlUpdate(input, valueKey) {
  const trimmed = normalizeTextUpdate(input, valueKey);
  if (trimmed === undefined) return undefined;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    invalidSettings(`${valueKey} must be a valid http or https URL.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    invalidSettings(`${valueKey} must use http or https.`);
  }
  return trimmed;
}

function normalizeKeyUpdate(input, valueKey) {
  if (!(valueKey in input)) return undefined;
  const value = input[valueKey];
  if (value === null) return "replace_me";
  if (typeof value !== "string") invalidSettings(`${valueKey} must be a string or null.`);
  const trimmed = value.trim();
  if (!trimmed) invalidSettings(`${valueKey} cannot be empty; omit it to keep the current key.`);
  if (/[\r\n]/.test(trimmed)) invalidSettings(`${valueKey} cannot contain line breaks.`);
  return trimmed;
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

export async function readProviderStatus() {
  const env = await loadEnv();
  const providers = Object.fromEntries(
    configuredProviders(env).map(({ id, configured }) => [id, { configured }])
  );
  const total = Object.keys(providers).length;
  const configuredCount = Object.values(providers).filter((item) => item.configured).length;
  return { providers, configuredCount, total };
}

export async function readAdminProviderSettings() {
  const env = await loadEnv();
  return {
    schemaVersion: PROVIDER_SETTINGS_SCHEMA_VERSION,
    providers: PROVIDER_DEFINITIONS.map((provider) => sanitizeProviderDefinition(provider, env))
  };
}

export function providerSettingDefinitions() {
  return PROVIDER_DEFINITIONS;
}

export async function updateAdminProviderSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    invalidSettings("Submit a provider settings object.");
  }

  const updates = {};
  for (const [valueKey, value] of Object.entries(input)) {
    const match = FIELD_BY_VALUE_KEY.get(valueKey);
    if (!match) invalidSettings(`Unsupported provider setting: ${valueKey}`);

    let normalized;
    if (match.field.name === "apiUrl") normalized = normalizeUrlUpdate(input, valueKey);
    else if (match.field.name === "model") normalized = normalizeTextUpdate(input, valueKey);
    else if (match.field.name === "apiKey") normalized = normalizeKeyUpdate(input, valueKey);
    else invalidSettings(`Unsupported provider setting type: ${valueKey}`);

    if (normalized !== undefined) updates[match.field.envKey] = normalized;
    void value;
  }

  if (Object.keys(updates).length) {
    const current = await readEnvText();
    await writeEnvAtomically(updateEnvText(current, updates));
  }
  return readAdminProviderSettings();
}

// Backward-compatible names return only the public status contract.
export const readProviderSettings = readProviderStatus;
export const updateProviderSettings = updateAdminProviderSettings;

import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";

import { loadEnv, localEnvPath } from "../config.mjs";
import {
  hasUsableApiKey,
  maskedApiKeyPreview
} from "../ai-providers/provider-utils.mjs";
import { DomainError } from "../workflow-domain/domain-error.mjs";

export const PROVIDER_SETTINGS_SCHEMA_VERSION = 4;

const DEFAULT_IMAGE_API_URL = "https://www.right.codes/draw/v1/images/generations";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_VIDEO_API_URL = "https://clmm-mall.top/v1/videos/generations";
const DEFAULT_VIDEO_MODEL = "seedance2.0 720p-fast";

const IMAGE_CHANNEL_SPECS = Object.freeze([
  {
    id: "primary",
    title: "绘图通道 A",
    description: "固定用于 0-10s 故事板",
    segmentId: "0-10s",
    apiUrlValueKey: "imageApiUrl",
    apiUrlEnvKey: "IMAGE_API_URL",
    modelValueKey: "imageModel",
    modelEnvKey: "IMAGE_MODEL",
    apiKeyValueKey: "imageApiKey",
    apiKeyEnvKey: "IMAGE_MODEL_API_KEY"
  },
  {
    id: "secondary",
    title: "绘图通道 B",
    description: "固定用于 10-20s 故事板",
    segmentId: "10-20s",
    apiUrlValueKey: "imageSecondaryApiUrl",
    apiUrlEnvKey: "IMAGE_SECONDARY_API_URL",
    modelValueKey: "imageSecondaryModel",
    modelEnvKey: "IMAGE_SECONDARY_MODEL",
    apiKeyValueKey: "imageSecondaryApiKey",
    apiKeyEnvKey: "IMAGE_SECONDARY_API_KEY"
  }
]);

function imageChannelFields() {
  return IMAGE_CHANNEL_SPECS.flatMap((channel) => ([
    {
      name: "apiUrl",
      label: "API 地址",
      type: "url",
      channelId: channel.id,
      valueKey: channel.apiUrlValueKey,
      clearable: false,
      envKey: channel.apiUrlEnvKey,
      defaultValue: DEFAULT_IMAGE_API_URL
    },
    {
      name: "model",
      label: "模型",
      type: "select",
      channelId: channel.id,
      valueKey: channel.modelValueKey,
      clearable: false,
      envKey: channel.modelEnvKey,
      defaultValue: DEFAULT_IMAGE_MODEL
    },
    {
      name: "apiKey",
      label: "API Key",
      type: "secret",
      channelId: channel.id,
      valueKey: channel.apiKeyValueKey,
      clearable: true,
      envKey: channel.apiKeyEnvKey
    }
  ]));
}

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
    channel: "双绘图通道",
    channels: IMAGE_CHANNEL_SPECS.map(({ id, title, description, segmentId }) => ({
      id,
      title,
      description,
      segmentId
    })),
    fields: imageChannelFields()
  },
  {
    id: "video",
    title: "视频生成模型",
    provider: "clmm-mall.top",
    role: "Step 05 两段视频生成",
    channel: "OpenAI-video 兼容通道",
    fields: [
      {
        name: "apiUrl",
        label: "API 地址",
        type: "url",
        valueKey: "videoApiUrl",
        clearable: false,
        envKey: "VIDEO_API_URL",
        defaultValue: DEFAULT_VIDEO_API_URL
      },
      {
        name: "model",
        label: "模型",
        type: "select",
        valueKey: "videoModel",
        clearable: false,
        envKey: "VIDEO_MODEL",
        defaultValue: DEFAULT_VIDEO_MODEL
      },
      {
        name: "apiKey",
        label: "API Key",
        type: "secret",
        valueKey: "videoApiKey",
        clearable: true,
        envKey: "VIDEO_MODEL_API_KEY"
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

function sanitizeField(field) {
  const { envKey, defaultValue, ...rest } = field;
  void envKey;
  void defaultValue;
  return rest;
}

function imageChannelConfig(env, spec, { includeApiKey = false } = {}) {
  const apiUrl = env[spec.apiUrlEnvKey] || DEFAULT_IMAGE_API_URL;
  const model = env[spec.modelEnvKey] || DEFAULT_IMAGE_MODEL;
  const apiKey = env[spec.apiKeyEnvKey] || "";
  const channel = {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    segmentId: spec.segmentId,
    apiUrl,
    model,
    configured: hasUsableApiKey(apiKey),
    keyPreview: maskedApiKeyPreview(apiKey)
  };
  if (includeApiKey) channel.apiKey = apiKey;
  return channel;
}

function sanitizeProviderDefinition(provider, env) {
  if (provider.id === "image") {
    const channels = IMAGE_CHANNEL_SPECS.map((channel) => imageChannelConfig(env, channel));
    return {
      id: provider.id,
      title: provider.title,
      provider: provider.provider,
      role: provider.role,
      channel: provider.channel,
      channels: provider.channels,
      fields: provider.fields.map(sanitizeField),
      config: {
        model: channels[0]?.model || "",
        apiUrl: channels[0]?.apiUrl || "",
        configured: channels.every((channel) => channel.configured),
        keyPreview: channels[0]?.keyPreview || "",
        configuredChannels: channels.filter((channel) => channel.configured).length,
        requiredChannels: channels.length,
        channels
      }
    };
  }

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
    fields: provider.fields.map(sanitizeField),
    config: {
      model: modelField ? fieldValue(env, modelField) : "",
      apiUrl: urlField ? fieldValue(env, urlField) : "",
      configured: hasUsableApiKey(apiKey),
      keyPreview: maskedApiKeyPreview(apiKey)
    }
  };
}

function configuredProviders(env) {
  return PROVIDER_DEFINITIONS.map((provider) => {
    if (provider.id === "image") {
      return {
        id: provider.id,
        configured: IMAGE_CHANNEL_SPECS
          .every((channel) => hasUsableApiKey(env[channel.apiKeyEnvKey] || ""))
      };
    }
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

export function readImageDrawChannels(env) {
  return IMAGE_CHANNEL_SPECS.map((channel) => imageChannelConfig(env, channel, {
    includeApiKey: true
  }));
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
  for (const valueKey of Object.keys(input)) {
    const match = FIELD_BY_VALUE_KEY.get(valueKey);
    if (!match) invalidSettings(`Unsupported provider setting: ${valueKey}`);

    let normalized;
    if (match.field.name === "apiUrl") normalized = normalizeUrlUpdate(input, valueKey);
    else if (match.field.name === "model") normalized = normalizeTextUpdate(input, valueKey);
    else if (match.field.name === "apiKey") normalized = normalizeKeyUpdate(input, valueKey);
    else invalidSettings(`Unsupported provider setting type: ${valueKey}`);

    if (normalized !== undefined) updates[match.field.envKey] = normalized;
  }

  if (Object.keys(updates).length) {
    const current = await readEnvText();
    await writeEnvAtomically(updateEnvText(current, updates));
  }
  return readAdminProviderSettings();
}

export const readProviderSettings = readProviderStatus;
export const updateProviderSettings = updateAdminProviderSettings;

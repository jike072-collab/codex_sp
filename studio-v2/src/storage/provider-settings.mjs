import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";

import { loadEnv, localEnvPath } from "../config.mjs";
import {
  hasUsableApiKey,
  maskedApiKeyPreview
} from "../ai-providers/provider-utils.mjs";
import { DomainError } from "../workflow-domain/domain-error.mjs";

export const PROVIDER_SETTINGS_SCHEMA_VERSION = 5;

const DEFAULT_IMAGE_API_URL = "https://www.right.codes/draw/v1/images/generations";
const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_VIDEO_API_URL = "https://clmm-mall.top/v1/videos/generations";
const DEFAULT_VIDEO_MODEL = "seedance2.0 720p-fast";
const SUB2API_BASE_URL = "http://127.0.0.1:8080/v1";

function urlPresets(defaultPreset, sub2apiPreset = null) {
  return [
    defaultPreset,
    ...(sub2apiPreset ? [sub2apiPreset] : [])
  ];
}

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
      defaultValue: DEFAULT_IMAGE_API_URL,
      presets: urlPresets(
        {
          id: "right-code-draw",
          label: "Right Code Draw",
          value: DEFAULT_IMAGE_API_URL
        },
        {
          id: "sub2api-local-images",
          label: "Sub2API 本机图片通道",
          value: `${SUB2API_BASE_URL}/images/generations`,
          hint: "需要本机 Sub2API 容器支持 images/generations，并使用对应客户端 Key。"
        }
      )
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
        defaultValue: "https://right.codes/gemini",
        presets: urlPresets(
          {
            id: "right-code-gemini",
            label: "Right Code Gemini",
            value: "https://right.codes/gemini"
          },
          {
            id: "sub2api-local-chat",
            label: "Sub2API 本机图文通道",
            value: `${SUB2API_BASE_URL}/chat/completions`,
            hint: "需要选择支持图片输入的模型；Key 从 Sub2API 的 openai-default 或 gemini-default 复制。"
          }
        )
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
        defaultValue: "https://api.deepseek.com/chat/completions",
        presets: urlPresets(
          {
            id: "deepseek-chat",
            label: "DeepSeek 官方",
            value: "https://api.deepseek.com/chat/completions"
          },
          {
            id: "sub2api-local-chat",
            label: "Sub2API 本机对话通道",
            value: `${SUB2API_BASE_URL}/chat/completions`,
            hint: "选择后保存，再刷新模型列表；Key 从 Sub2API 客户端 Key 页面复制。"
          }
        )
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
        defaultValue: DEFAULT_VIDEO_API_URL,
        presets: urlPresets(
          {
            id: "clmm-video",
            label: "clmm-mall 视频通道",
            value: DEFAULT_VIDEO_API_URL
          },
          {
            id: "sub2api-local-videos",
            label: "Sub2API 本机视频通道",
            value: `${SUB2API_BASE_URL}/videos/generations`,
            hint: "只有当本机 Sub2API 映射的视频模型支持 videos/generations 时才可用。"
          }
        )
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

function profileIdFromPresetId(id) {
  return String(id || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function profileEnvKey(envKey, profileId) {
  const suffix = profileIdFromPresetId(profileId);
  return suffix ? `${envKey}__${suffix}` : "";
}

function profileForUrl(field, apiUrl) {
  return (field.presets || []).find((preset) => preset?.value === apiUrl) || null;
}

function fieldGroup(provider, channelId = "") {
  const matchesChannel = (field) => channelId ? field.channelId === channelId : !field.channelId;
  return {
    provider,
    channelId,
    urlField: provider.fields.find((field) => field.name === "apiUrl" && matchesChannel(field)),
    modelField: provider.fields.find((field) => field.name === "model" && matchesChannel(field)),
    keyField: provider.fields.find((field) => field.name === "apiKey" && matchesChannel(field))
  };
}

function providerFieldGroups() {
  return PROVIDER_DEFINITIONS.flatMap((provider) => {
    if (provider.id === "image") return IMAGE_CHANNEL_SPECS.map((channel) => fieldGroup(provider, channel.id));
    return [fieldGroup(provider)];
  });
}

function providerFieldGroup(providerId, channelId = "") {
  const provider = PROVIDER_DEFINITIONS.find((item) => item.id === providerId);
  if (!provider) invalidSettings("未知的供应商模型预览请求。");
  if (provider.id === "image") {
    const channel = IMAGE_CHANNEL_SPECS.find((item) => item.id === channelId);
    if (!channel) invalidSettings("图片供应商模型预览必须指定有效通道。");
    return fieldGroup(provider, channel.id);
  }
  if (channelId) invalidSettings("该供应商不支持通道参数。");
  return fieldGroup(provider);
}

function parseEnvText(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function profileValue(env, field, preset, activeValue = "") {
  if (!field || !preset?.id) return "";
  const stored = env[profileEnvKey(field.envKey, preset.id)] || "";
  return stored || (preset.value === activeValue ? env[field.envKey] || "" : "");
}

function profilePreviews(env, { urlField, modelField, keyField }) {
  if (!urlField || !keyField) return [];
  const activeUrl = fieldValue(env, urlField);
  return (urlField.presets || []).map((preset) => {
    const apiKey = profileValue(env, keyField, preset, activeUrl);
    const model = modelField ? profileValue(env, modelField, preset, activeUrl) : "";
    return {
      id: preset.id,
      value: preset.value,
      label: preset.label || preset.id || preset.value,
      configured: hasUsableApiKey(apiKey),
      keyPreview: maskedApiKeyPreview(apiKey),
      model
    };
  });
}

function imageChannelConfig(env, spec, { includeApiKey = false } = {}) {
  const apiUrl = env[spec.apiUrlEnvKey] || DEFAULT_IMAGE_API_URL;
  const model = env[spec.modelEnvKey] || DEFAULT_IMAGE_MODEL;
  const apiKey = env[spec.apiKeyEnvKey] || "";
  const urlField = {
    envKey: spec.apiUrlEnvKey,
    presets: urlPresets(
      {
        id: "right-code-draw",
        label: "Right Code Draw",
        value: DEFAULT_IMAGE_API_URL
      },
      {
        id: "sub2api-local-images",
        label: "Sub2API 本机图片通道",
        value: `${SUB2API_BASE_URL}/images/generations`
      }
    )
  };
  const channel = {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    segmentId: spec.segmentId,
    apiUrl,
    model,
    configured: hasUsableApiKey(apiKey),
    keyPreview: maskedApiKeyPreview(apiKey),
    profiles: profilePreviews(env, {
      urlField,
      modelField: { envKey: spec.modelEnvKey },
      keyField: { envKey: spec.apiKeyEnvKey }
    })
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
      keyPreview: maskedApiKeyPreview(apiKey),
      profiles: profilePreviews(env, { urlField, modelField, keyField })
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

export async function readAdminProviderModelTarget({
  providerId,
  channelId = "",
  apiUrl
}) {
  const group = providerFieldGroup(String(providerId || "").trim(), String(channelId || "").trim());
  if (!group.urlField || !group.modelField || !group.keyField) {
    invalidSettings("供应商模型预览配置不完整。");
  }

  const normalizedUrl = normalizeUrlUpdate({ apiUrl }, "apiUrl");
  const env = await loadEnv();
  const activeUrl = fieldValue(env, group.urlField);
  const activeModel = fieldValue(env, group.modelField);
  const selectedProfile = profileForUrl(group.urlField, normalizedUrl);
  const isActiveCustomUrl = !selectedProfile && normalizedUrl === activeUrl;

  return {
    providerId: group.provider.id,
    channelId: group.channelId,
    apiUrl: normalizedUrl,
    model: selectedProfile
      ? profileValue(env, group.modelField, selectedProfile, activeUrl)
        || group.modelField.defaultValue
        || activeModel
      : isActiveCustomUrl
        ? activeModel
        : group.modelField.defaultValue || activeModel,
    apiKey: selectedProfile
      ? profileValue(env, group.keyField, selectedProfile, activeUrl)
      : isActiveCustomUrl
        ? env[group.keyField.envKey] || ""
        : ""
  };
}

export function providerSettingDefinitions() {
  return PROVIDER_DEFINITIONS;
}

export async function updateAdminProviderSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    invalidSettings("Submit a provider settings object.");
  }

  const currentText = await readEnvText();
  const env = parseEnvText(currentText);
  const normalizedInput = new Map();
  for (const valueKey of Object.keys(input)) {
    const match = FIELD_BY_VALUE_KEY.get(valueKey);
    if (!match) invalidSettings(`Unsupported provider setting: ${valueKey}`);

    let normalizedValue;
    if (match.field.name === "apiUrl") normalizedValue = normalizeUrlUpdate(input, valueKey);
    else if (match.field.name === "model") normalizedValue = normalizeTextUpdate(input, valueKey);
    else if (match.field.name === "apiKey") normalizedValue = normalizeKeyUpdate(input, valueKey);
    else invalidSettings(`Unsupported provider setting type: ${valueKey}`);

    if (normalizedValue !== undefined) normalizedInput.set(valueKey, normalizedValue);
  }

  const updates = {};
  for (const group of providerFieldGroups()) {
    if (!group.urlField || !group.modelField || !group.keyField) continue;

    const currentUrl = env[group.urlField.envKey] || group.urlField.defaultValue || "";
    const nextUrl = normalizedInput.has(group.urlField.valueKey)
      ? normalizedInput.get(group.urlField.valueKey)
      : currentUrl;
    const currentProfile = profileForUrl(group.urlField, currentUrl);
    const nextProfile = profileForUrl(group.urlField, nextUrl);
    const currentModel = env[group.modelField.envKey] || group.modelField.defaultValue || "";
    const currentKey = env[group.keyField.envKey] || "";

    if (currentProfile && currentProfile.id && currentProfile.id !== nextProfile?.id) {
      updates[profileEnvKey(group.modelField.envKey, currentProfile.id)] = currentModel;
      updates[profileEnvKey(group.keyField.envKey, currentProfile.id)] = currentKey || "replace_me";
    }

    if (normalizedInput.has(group.urlField.valueKey)) {
      updates[group.urlField.envKey] = nextUrl;
    }

    if (normalizedInput.has(group.modelField.valueKey)) {
      const model = normalizedInput.get(group.modelField.valueKey);
      updates[group.modelField.envKey] = model;
      if (nextProfile?.id) updates[profileEnvKey(group.modelField.envKey, nextProfile.id)] = model;
    } else if (nextProfile?.id) {
      const storedModel = env[profileEnvKey(group.modelField.envKey, nextProfile.id)];
      updates[group.modelField.envKey] = storedModel || currentModel;
    }

    if (normalizedInput.has(group.keyField.valueKey)) {
      const key = normalizedInput.get(group.keyField.valueKey);
      updates[group.keyField.envKey] = key;
      if (nextProfile?.id) updates[profileEnvKey(group.keyField.envKey, nextProfile.id)] = key;
    } else if (nextProfile?.id) {
      const storedKey = env[profileEnvKey(group.keyField.envKey, nextProfile.id)];
      updates[group.keyField.envKey] = storedKey || (currentProfile?.id !== nextProfile.id ? "replace_me" : currentKey);
    }
  }

  if (Object.keys(updates).length) {
    await writeEnvAtomically(updateEnvText(currentText, updates));
  }
  return readAdminProviderSettings();
}

export const readProviderSettings = readProviderStatus;
export const updateProviderSettings = updateAdminProviderSettings;

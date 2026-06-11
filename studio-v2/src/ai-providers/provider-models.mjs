import { loadEnv } from "../config.mjs";
import {
  hasUsableApiKey,
  positiveInteger
} from "./provider-utils.mjs";
import { providerSettingDefinitions } from "../storage/provider-settings.mjs";

const MODEL_DISCOVERY_CACHE_MS = 5 * 60 * 1000;
const discoveryCache = new Map();

function field(provider, name) {
  return provider.fields.find((item) => item.name === name);
}

function valueFor(env, fieldDefinition) {
  return env[fieldDefinition.envKey] || fieldDefinition.defaultValue || "";
}

function fallback(currentModel, status, message) {
  return {
    status,
    currentModel,
    models: [{ id: currentModel, label: currentModel }],
    source: "current",
    message
  };
}

function cacheKey(providerId, apiUrl, currentModel, configured) {
  return [providerId, apiUrl, currentModel, configured ? "configured" : "missing-key"].join("|");
}

function cached(key) {
  const entry = discoveryCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    discoveryCache.delete(key);
    return null;
  }
  return structuredClone(entry.value);
}

function remember(key, value) {
  if (value.status !== "ok") return;
  discoveryCache.set(key, {
    expiresAt: Date.now() + MODEL_DISCOVERY_CACHE_MS,
    value: structuredClone(value)
  });
}

function appendPath(apiUrl, path) {
  return `${apiUrl.replace(/\/+$/, "")}${path}`;
}

function replaceEndpointPath(apiUrl, pattern, replacement) {
  const parsed = new URL(apiUrl);
  if (!pattern.test(parsed.pathname)) return null;
  parsed.pathname = parsed.pathname.replace(pattern, replacement);
  parsed.search = "";
  return parsed.toString();
}

function modelListUrl(providerId, apiUrl) {
  if (providerId === "vision") {
    if (/\/draw(?:\/|$)/i.test(apiUrl)) return null;
    if (/\/v1beta\/models\/?$/i.test(apiUrl)) return apiUrl;
    return appendPath(apiUrl, "/v1beta/models");
  }
  if (providerId === "text") {
    if (/\/models\/?$/i.test(new URL(apiUrl).pathname)) return apiUrl;
    return replaceEndpointPath(apiUrl, /\/chat\/completions\/?$/i, "/models");
  }
  if (providerId === "image") {
    if (/\/models\/?$/i.test(new URL(apiUrl).pathname)) return apiUrl;
    return replaceEndpointPath(apiUrl, /\/images\/generations\/?$/i, "/models");
  }
  return null;
}

function authHeaders(providerId, apiKey) {
  if (providerId === "vision") return { "x-goog-api-key": apiKey };
  return { Authorization: `Bearer ${apiKey}` };
}

function modelId(value) {
  if (typeof value === "string") return value.replace(/^models\//, "");
  if (typeof value?.id === "string") return value.id;
  if (typeof value?.name === "string") return value.name.replace(/^models\//, "");
  return "";
}

function modelLabel(value, id) {
  if (typeof value === "string") return id;
  return value?.displayName || value?.label || id;
}

function parseModels(payload) {
  const rawModels = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];
  const unique = new Map();
  for (const raw of rawModels) {
    const id = modelId(raw);
    if (!id) continue;
    unique.set(id, { id, label: modelLabel(raw, id) });
  }
  return [...unique.values()];
}

async function fetchModelList(provider, { env, fetchImpl, timeoutMs }) {
  const currentModel = valueFor(env, field(provider, "model"));
  const apiUrl = valueFor(env, field(provider, "apiUrl"));
  const apiKey = env[field(provider, "apiKey").envKey];

  if (!hasUsableApiKey(apiKey)) {
    return fallback(currentModel, "error", "未配置 API Key，无法从供应商发现模型。");
  }

  let url;
  try {
    url = modelListUrl(provider.id, apiUrl);
  } catch {
    return fallback(currentModel, "unsupported", "当前 API 地址无法推导模型列表端点。");
  }
  if (!url) {
    return fallback(currentModel, "unsupported", "当前供应商通道没有已知的模型列表端点。");
  }

  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: authHeaders(provider.id, apiKey),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch {
    return fallback(currentModel, "error", "模型发现请求失败或超时。");
  }

  if ([404, 405].includes(response.status)) {
    return fallback(currentModel, "unsupported", "供应商未提供可用的模型列表端点。");
  }
  if (!response.ok) {
    return fallback(currentModel, "error", `模型发现失败，供应商返回 HTTP ${response.status}。`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return fallback(currentModel, "error", "模型发现返回了无效 JSON。");
  }
  const models = parseModels(payload);
  if (!models.length) {
    return fallback(currentModel, "error", "供应商返回了空模型列表。");
  }
  if (!models.some((model) => model.id === currentModel)) {
    models.unshift({ id: currentModel, label: `${currentModel}（当前配置）` });
  }
  return {
    status: "ok",
    currentModel,
    models,
    source: "provider"
  };
}

export function clearProviderModelDiscoveryCache() {
  discoveryCache.clear();
}

export async function discoverAdminProviderModels({
  refresh = false,
  fetchImpl = fetch
} = {}) {
  const env = await loadEnv();
  const timeoutMs = positiveInteger(env.MODEL_DISCOVERY_TIMEOUT_MS, 15000);
  const providers = {};

  for (const provider of providerSettingDefinitions()) {
    const currentModel = valueFor(env, field(provider, "model"));
    const apiUrl = valueFor(env, field(provider, "apiUrl"));
    const apiKey = env[field(provider, "apiKey").envKey];
    const key = cacheKey(provider.id, apiUrl, currentModel, hasUsableApiKey(apiKey));
    const existing = refresh ? null : cached(key);
    if (existing) {
      providers[provider.id] = existing;
      continue;
    }
    const discovered = await fetchModelList(provider, { env, fetchImpl, timeoutMs });
    remember(key, discovered);
    providers[provider.id] = discovered;
  }

  return { providers };
}

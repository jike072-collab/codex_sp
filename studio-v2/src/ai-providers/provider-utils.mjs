const PLACEHOLDER_KEYS = new Set([
  "",
  "replace_me",
  "your_key",
  "your_api_key"
]);

export class ProviderError extends Error {
  constructor(message, { code = "PROVIDER_ERROR", providerStatus, cause } = {}) {
    super(message, { cause });
    this.name = "ProviderError";
    this.code = code;
    this.statusCode = 502;
    this.providerStatus = providerStatus;
  }
}

export function hasUsableApiKey(value) {
  return !PLACEHOLDER_KEYS.has(String(value || "").trim().toLowerCase());
}

export function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function extractJsonObject(text, label = "模型") {
  const trimmed = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // Fall through to the stable provider error below.
      }
    }
    throw new ProviderError(`${label}没有返回有效 JSON。`, {
      code: "INVALID_PROVIDER_JSON"
    });
  }
}

export async function postProviderJson({
  url,
  apiKey,
  body,
  timeoutMs,
  providerLabel,
  errorCode,
  fetchImpl = fetch
}) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new ProviderError(
      timedOut ? `${providerLabel}请求超时。` : `${providerLabel}连接失败。`,
      { code: errorCode, cause: error }
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.error?.message || payload?.message || "";
    } catch {
      // Provider error bodies are not guaranteed to be JSON.
    }
    const suffix = detail ? `：${String(detail).slice(0, 180)}` : "";
    throw new ProviderError(
      `${providerLabel}调用失败（HTTP ${response.status}）${suffix}`,
      {
        code: errorCode,
        providerStatus: response.status
      }
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ProviderError(`${providerLabel}返回了无效响应。`, {
      code: errorCode,
      providerStatus: response.status,
      cause: error
    });
  }
}

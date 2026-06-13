const PLACEHOLDER_KEYS = new Set([
  "",
  "replace_me",
  "your_key",
  "your_api_key"
]);

export class ProviderError extends Error {
  constructor(
    message,
    {
      code = "PROVIDER_ERROR",
      providerStatus,
      providerRequestId,
      possiblyBilled = false,
      retryable = false,
      cause
    } = {}
  ) {
    super(message, { cause });
    this.name = "ProviderError";
    this.code = code;
    this.statusCode = 502;
    this.providerStatus = providerStatus;
    this.providerRequestId = providerRequestId;
    this.possiblyBilled = possiblyBilled;
    this.retryable = retryable;
  }
}

export function hasUsableApiKey(value) {
  return !PLACEHOLDER_KEYS.has(String(value || "").trim().toLowerCase());
}

export function maskedApiKeyPreview(value) {
  const key = String(value || "").trim();
  if (!hasUsableApiKey(key)) return "";
  return `•••• ${key.slice(-4)}`;
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

function retryableProviderDetail(detail) {
  return /excessive\s+system\s+load|system\s+load|overload|temporar(?:y|ily)\s+unavailable/i
    .test(String(detail || ""));
}

function retryableErrorCode(errorCode, suffix) {
  return errorCode.endsWith("_ERROR")
    ? errorCode.replace(/_ERROR$/, suffix)
    : errorCode;
}

function safeProviderRequestId(headers) {
  for (const name of [
    "x-request-id",
    "x-correlation-id",
    "x-trace-id",
    "cf-ray",
    "request-id"
  ]) {
    const value = headers?.get?.(name);
    if (value) return String(value).slice(0, 120);
  }
  return undefined;
}

async function postProviderRequest({
  url,
  apiKey,
  body,
  timeoutMs,
  providerLabel,
  errorCode,
  includeProviderDetail = true,
  headers,
  contentType,
  fetchImpl = fetch
}) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        ...(contentType ? { "Content-Type": contentType } : {}),
        ...(headers || { Authorization: `Bearer ${apiKey}` })
      },
      body,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    const code = timedOut ? retryableErrorCode(errorCode, "_TIMEOUT") : errorCode;
    throw new ProviderError(
      timedOut ? `${providerLabel}请求超时。` : `${providerLabel}连接失败。`,
      { code, possiblyBilled: timedOut, retryable: timedOut, cause: error }
    );
  }

  if (!response.ok) {
    const timedOut = [408, 504, 524].includes(response.status);
    let detail = "";
    try {
      const payload = await response.json();
      detail = typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message || payload?.message || "";
    } catch {
      // Provider error bodies are not guaranteed to be JSON.
    }
    const suffix = includeProviderDetail && detail ? `：${String(detail).slice(0, 180)}` : "";
    const overloaded = retryableProviderDetail(detail);
    throw new ProviderError(
      `${providerLabel}调用失败（HTTP ${response.status}）${suffix}`,
      {
        code: timedOut
          ? retryableErrorCode(errorCode, "_TIMEOUT")
          : overloaded
            ? retryableErrorCode(errorCode, "_OVERLOADED")
            : errorCode,
        providerStatus: response.status,
        providerRequestId: safeProviderRequestId(response.headers),
        possiblyBilled: timedOut,
        retryable: timedOut || overloaded
      }
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ProviderError(`${providerLabel}返回了无效响应。`, {
      code: errorCode,
      providerStatus: response.status,
      providerRequestId: safeProviderRequestId(response.headers),
      cause: error
    });
  }
}

export async function postProviderJson(options) {
  return postProviderRequest({
    ...options,
    body: JSON.stringify(options.body),
    contentType: "application/json"
  });
}

export async function postProviderFormData(options) {
  if (!(options.body instanceof FormData)) {
    throw new TypeError("postProviderFormData body must be a FormData instance.");
  }
  return postProviderRequest(options);
}

import { handleApi } from "./api-routes.mjs";
import { adminRoot, publicRoot, uploadsRoot } from "../config.mjs";
import { sendJson } from "./http-helpers.mjs";
import { serveFile } from "./static-files.mjs";
import { isExpectedError } from "../workflow-domain/domain-error.mjs";

function errorResponseBody(error) {
  return {
    error: error.message || "服务器错误。",
    code: error.code || "INTERNAL_ERROR",
    ...(typeof error.retryable === "boolean" ? { retryable: error.retryable } : {}),
    ...(typeof error.possiblyBilled === "boolean" ? { possiblyBilled: error.possiblyBilled } : {}),
    ...(Number.isInteger(error.providerStatus) ? { providerStatus: error.providerStatus } : {})
  };
}

export function createRequestHandler() {
  return async function requestHandler(request, response) {
    try {
      const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
      if (url.pathname.startsWith("/api/")) {
        const handled = await handleApi(request, response, url);
        if (handled === false) sendJson(response, 404, { error: "接口不存在。" });
        return;
      }
      if (url.pathname.startsWith("/uploads/")) {
        return serveFile(response, uploadsRoot, url.pathname.slice("/uploads/".length));
      }
      if (url.pathname === "/admin") {
        response.writeHead(302, { Location: "/admin/" });
        response.end();
        return;
      }
      if (url.pathname.startsWith("/admin/")) {
        const relativeAdminPath = url.pathname === "/admin/"
          ? "index.html"
          : url.pathname.slice("/admin/".length);
        return serveFile(response, adminRoot, relativeAdminPath, {
          cacheControl: "no-store, max-age=0"
        });
      }
      const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      return serveFile(response, publicRoot, relativePath);
    } catch (error) {
      if (!isExpectedError(error)) console.error(error);
      if (!response.headersSent) {
        sendJson(response, error.statusCode || 500, errorResponseBody(error));
      }
      else response.end();
    }
  };
}

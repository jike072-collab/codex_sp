import { handleApi } from "./api-routes.mjs";
import { publicRoot, uploadsRoot } from "../config.mjs";
import { sendJson } from "./http-helpers.mjs";
import { serveFile } from "./static-files.mjs";

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
      const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      return serveFile(response, publicRoot, relativePath);
    } catch (error) {
      console.error(error);
      if (!response.headersSent) sendJson(response, 500, { error: error.message || "服务器错误。" });
      else response.end();
    }
  };
}

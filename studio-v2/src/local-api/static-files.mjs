import { readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

import { sendText } from "./http-helpers.mjs";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

export async function serveFile(response, root, relativePath, {
  cacheControl = ""
} = {}) {
  const resolvedRoot = resolve(root);
  const target = resolve(join(resolvedRoot, relativePath));
  const pathFromRoot = relative(resolvedRoot, target);
  if (pathFromRoot.startsWith("..") || pathFromRoot.includes(":")) {
    return sendText(response, 403, "Forbidden");
  }
  try {
    const bytes = await readFile(target);
    const headers = {
      "Content-Type": contentTypes[extname(target).toLowerCase()] || "application/octet-stream",
      "Content-Length": bytes.length
    };
    if (cacheControl) headers["Cache-Control"] = cacheControl;
    response.writeHead(200, headers);
    response.end(bytes);
  } catch (error) {
    if (error.code === "ENOENT") return sendText(response, 404, "Not found");
    throw error;
  }
}

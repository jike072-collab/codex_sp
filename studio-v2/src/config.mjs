import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const studioRoot = fileURLToPath(new URL("../", import.meta.url));
export const projectRoot = resolve(studioRoot, "..");
export const publicRoot = join(studioRoot, "public");
export const dataRoot = join(studioRoot, "data");
export const projectsRoot = join(dataRoot, "projects");
export const uploadsRoot = join(dataRoot, "uploads");
const runtimeEnv = typeof process === "undefined" ? {} : process.env;
export const port = Number(runtimeEnv.PORT || 8810);

export async function loadEnv() {
  const values = {};
  try {
    const text = await readFile(join(projectRoot, ".env"), "utf8");
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
  } catch {
    // A missing .env is valid for the local demo workflow.
  }
  return { ...values, ...runtimeEnv };
}

export function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => cleanString(item)).filter(Boolean);
  if (typeof value === "string") {
    return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

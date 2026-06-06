export const state = {
  projects: [],
  project: null,
  busy: false
};

export const el = (id) => document.getElementById(id);

export const countryNames = {
  Thailand: "泰国",
  Indonesia: "印度尼西亚",
  Vietnam: "越南",
  Philippines: "菲律宾",
  Malaysia: "马来西亚",
  Singapore: "新加坡"
};

export async function api(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败：${response.status}`);
  return payload;
}

export function showToast(message) {
  const toast = el("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

export function setBusy(value, message = "处理中...") {
  state.busy = value;
  el("analyzeButton").disabled = value || !state.project?.assets?.length;
  el("analyzeButton").textContent = value ? message : "识别并锁定产品";
  el("saveState").textContent = value ? message : "已保存到本机";
}

export function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function statusLabel(status) {
  const labels = {
    assets: "商品素材",
    analyzing: "识别中",
    review: "产品锁定",
    market: "市场创意",
    script: "广告脚本",
    visual: "视觉资产",
    export: "交付导出"
  };
  return labels[status] || "商品素材";
}

export function valueAt(object, path, fallback = "") {
  return path.split(".").reduce((value, key) => value?.[key], object) ?? fallback;
}

export function lines(value) {
  return String(value || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
}


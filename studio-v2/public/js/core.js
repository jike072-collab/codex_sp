export const state = {
  projects: [],
  project: null,
  viewStatus: null,
  busy: false,
  visualGenerationError: "",
  deletingProjectIds: new Set(),
  projectSelectionMode: false,
  selectedProjectIds: new Set()
};

export const el = (id) => document.getElementById(id);

export const countryNames = {
  Thailand: "泰国",
  Vietnam: "越南",
  Philippines: "菲律宾",
  Malaysia: "马来西亚",
  Singapore: "新加坡"
};

export const marketCountryOptions = [
  ["Thailand", "泰国"],
  ["Vietnam", "越南"],
  ["Philippines", "菲律宾"],
  ["Malaysia", "马来西亚"],
  ["Singapore", "新加坡"]
];

export const aspectRatioOptions = [
  ["9:16", "竖屏短视频"],
  ["16:9", "横版视频"],
  ["1:1", "方形视频"],
  ["4:5", "信息流竖图"],
  ["3:4", "竖版素材"],
  ["2:3", "商品竖图"]
];

export const audienceOptions = [
  ["daily-commute", "日常运动与通勤人群", "走路、通勤、轻运动都能覆盖"],
  ["young-street", "年轻潮流穿搭人群", "关注造型、配色和出片感"],
  ["fitness-light", "轻运动健身人群", "强调稳定、轻快和日常训练"],
  ["campus", "校园与入门运动人群", "预算友好、活力、容易搭配"],
  ["outdoor-casual", "户外休闲人群", "周末出行、耐看、舒适"]
];

export const creativeThemeOptions = [
  ["city-motion", "城市动线", "日常出行、街区移动"],
  ["daily-comfort", "全天舒适", "通勤、长穿、稳定陪伴"],
  ["performance-detail", "性能细节", "结构、支撑、鞋底表现"],
  ["street-style", "街头风格", "造型、色彩、搭配感"]
];

export const toneOptions = [
  ["energetic", "有活力"],
  ["clean", "干净"],
  ["warm", "温暖"],
  ["bold", "大胆"]
];

function preferenceKey(projectId) {
  return `shoe-ad-studio:${projectId}:preferences`;
}

export function readProjectPreferences(project = state.project) {
  if (!project?.id) return {};
  try {
    return JSON.parse(window.localStorage.getItem(preferenceKey(project.id)) || "{}");
  } catch {
    return {};
  }
}

export function saveProjectPreferences(project = state.project, updates = {}) {
  if (!project?.id) return;
  const next = { ...readProjectPreferences(project), ...updates };
  try {
    window.localStorage.setItem(preferenceKey(project.id), JSON.stringify(next));
  } catch {
    // Local preference storage is optional; the workflow should keep running.
  }
}

export function projectSetup(project = state.project) {
  const saved = project?.marketBrief || {};
  const preferences = readProjectPreferences(project);
  const targetCountry = saved.targetCountry || preferences.targetCountry || project?.targetCountry || "Thailand";
  const outputAspectRatio = saved.outputAspectRatio || preferences.outputAspectRatio || "9:16";
  const creativeTheme = saved.creativeTheme || preferences.creativeTheme || "city-motion";
  const tone = saved.tone || preferences.tone || "energetic";
  const audience = saved.audience || preferences.audience || project?.audience || audienceOptions[0][1];
  const shotsPerSegment = Number(preferences.shotsPerSegment || 5);
  return {
    targetCountry: marketCountryOptions.some(([value]) => value === targetCountry)
      ? targetCountry
      : "Thailand",
    audience,
    coreMessage: saved.coreMessage || preferences.coreMessage || "",
    outputAspectRatio: aspectRatioOptions.some(([value]) => value === outputAspectRatio)
      ? outputAspectRatio
      : "9:16",
    creativeTheme: creativeThemeOptions.some(([value]) => value === creativeTheme)
      ? creativeTheme
      : "city-motion",
    tone: toneOptions.some(([value]) => value === tone) ? tone : "energetic",
    shotsPerSegment: [3, 4, 5].includes(shotsPerSegment) ? shotsPerSegment : 5
  };
}

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
  const canUpload = !value && state.project?.status === "assets";
  el("dropZone").disabled = !canUpload;
  el("fileInput").disabled = !canUpload;
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

import {
  countryNames,
  el,
  escapeHtml,
  formatTime,
  state,
  valueAt
} from "./core.js";

const CREATIVE_THEMES = {
  "city-motion": "城市动线",
  "daily-comfort": "全天舒适",
  "performance-detail": "性能细节",
  "street-style": "街头风格"
};

const TONES = {
  energetic: "有活力",
  clean: "干净",
  warm: "温暖",
  bold: "大胆"
};

const REQUIRED_FIELDS = {
  targetCountry: "目标国家",
  audience: "目标人群",
  creativeTheme: "创意主题",
  coreMessage: "一句话主张",
  tone: "语气"
};

function clean(value) {
  return String(value || "").trim();
}

function marketDefaults(project) {
  const saved = project.marketBrief || {};
  return {
    targetCountry: clean(saved.targetCountry) || project.targetCountry || "Thailand",
    audience: clean(saved.audience) || project.audience || "日常运动与通勤人群",
    creativeTheme: clean(saved.creativeTheme) || "city-motion",
    coreMessage: clean(saved.coreMessage),
    tone: clean(saved.tone) || "energetic"
  };
}

function listValue(value) {
  if (Array.isArray(value) && value.length) return value.join("、");
  return "未填写";
}

function setRadioValue(form, name, value) {
  const control = form.elements[name];
  control.value = value;
  if (!control.value) control.value = name === "tone" ? "energetic" : "city-motion";
}

export function fillMarketForm(project = state.project) {
  const form = el("marketForm");
  if (!form || !project) return;

  const brief = marketDefaults(project);
  form.elements.targetCountry.value = brief.targetCountry;
  form.elements.audience.value = brief.audience;
  form.elements.coreMessage.value = brief.coreMessage;
  setRadioValue(form, "creativeTheme", brief.creativeTheme);
  setRadioValue(form, "tone", brief.tone);
  el("marketHint").textContent = "保存后进入广告脚本阶段。";
}

export function marketBriefFromForm() {
  const form = el("marketForm");
  return {
    targetCountry: clean(form.elements.targetCountry.value),
    audience: clean(form.elements.audience.value),
    creativeTheme: clean(form.elements.creativeTheme.value),
    coreMessage: clean(form.elements.coreMessage.value),
    tone: clean(form.elements.tone.value)
  };
}

export function validateMarketBrief(marketBrief) {
  for (const [field, label] of Object.entries(REQUIRED_FIELDS)) {
    if (!marketBrief[field]) return `请填写${label}。`;
  }
  if (!CREATIVE_THEMES[marketBrief.creativeTheme]) return "请选择有效的创意主题。";
  if (!TONES[marketBrief.tone]) return "请选择有效的语气。";
  return "";
}

export function renderMarketProductSummary(project = state.project) {
  const container = el("marketProductSummary");
  if (!container || !project) return;

  const analysis = project.visionAnalysis || {};
  const lock = analysis.product_lock_manifest || {};
  const rows = [
    ["鞋款类型", valueAt(analysis, "product_summary.shoe_type", "未填写")],
    ["可能用途", valueAt(analysis, "product_summary.likely_usage.value", "未填写")],
    ["整体风格", valueAt(analysis, "product_summary.overall_style", "未填写")],
    ["主色", listValue(lock.main_colors)],
    ["必须保持", listValue(lock.must_keep)]
  ];

  container.innerHTML = `
    <div class="summary-heading">
      <p class="section-index">CONFIRMED SHOE</p>
      <h3>已确认鞋款摘要</h3>
    </div>
    <dl>
      ${rows.map(([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `).join("")}
    </dl>
  `;
}

export function renderMarketConfirmation(project = state.project) {
  if (!project) return;

  const brief = project.marketBrief || {};
  const country = countryNames[brief.targetCountry] || brief.targetCountry || "目标市场";
  const theme = CREATIVE_THEMES[brief.creativeTheme] || "创意方向";
  el("confirmedMarketTitle").textContent = `${country} · ${theme}`;
  el("marketConfirmedTime").textContent = project.marketConfirmedAt
    ? `保存时间：${formatTime(project.marketConfirmedAt)}`
    : "市场 brief 已保存。";
}

export function setMarketSaving(value) {
  state.busy = value;
  const button = el("saveMarketButton");
  if (button) {
    button.disabled = value;
    button.textContent = value ? "正在保存..." : "保存市场创意";
  }
  el("saveState").textContent = value ? "正在保存市场创意..." : "已保存到本机";
  el("marketHint").textContent = value ? "正在提交 market brief。" : "保存后进入广告脚本阶段。";
}

import {
  aspectRatioOptions,
  creativeThemeOptions,
  countryNames,
  el,
  escapeHtml,
  formatTime,
  lines,
  marketCountryOptions,
  projectSetup,
  saveProjectPreferences,
  state,
  statusLabel,
  toneOptions,
  valueAt
} from "./core.js";
import {
  renderExportStage,
  renderScriptStage,
  renderVisualStage
} from "./demo-loop.js";
import {
  fillMarketForm,
  renderMarketProductSummary
} from "./market.js";

const STAGE_ORDER = ["assets", "review", "market", "script", "visual", "export"];

function viewStatus() {
  if (!state.project) return "assets";
  if (!state.viewStatus) state.viewStatus = state.project.status;
  return state.viewStatus;
}

function isStageReached(step) {
  if (!state.project) return false;
  const currentStatus = state.project.status === "analyzing" ? "assets" : state.project.status;
  const current = STAGE_ORDER.indexOf(currentStatus);
  const target = STAGE_ORDER.indexOf(step);
  return target >= 0 && target <= current;
}

export function renderProjectList() {
  const container = el("projectList");
  if (!state.projects.length) {
    container.innerHTML = `<div class="project-link"><small>还没有项目</small></div>`;
    return;
  }
  container.innerHTML = state.projects.map((project) => `
    <div class="project-item ${project.id === state.project?.id ? "active" : ""}">
      <button class="project-link"
        data-project-id="${escapeHtml(project.id)}" type="button">
        <strong>${escapeHtml(project.name)}</strong>
        <small>${statusLabel(project.status)} · ${formatTime(project.updatedAt)}</small>
      </button>
      <button class="project-delete" data-delete-project-id="${escapeHtml(project.id)}"
        type="button" aria-label="删除 ${escapeHtml(project.name)}">×</button>
    </div>
  `).join("");
}

export function renderWorkspace() {
  const project = state.project;
  if (!project) return;
  const activeStatus = viewStatus();
  const isReviewingPast = activeStatus !== project.status;

  el("projectTitle").textContent = project.name;
  el("projectState").textContent = isReviewingPast
    ? `${statusLabel(project.status)} · 回看${statusLabel(activeStatus)}`
    : statusLabel(project.status);
  const setup = projectSetup(project);
  el("briefCountry").value = countryNames[setup.targetCountry] || setup.targetCountry || "";
  el("briefAudience").value = setup.audience || "";
  el("briefAspect").value = setup.outputAspectRatio;
  el("headerExportButton").disabled = project.status !== "export";

  renderAssets();
  renderStepper(activeStatus);
  renderCompletionList(activeStatus);

  el("assetsStage").classList.toggle("hidden", !["assets", "analyzing"].includes(activeStatus));
  el("reviewStage").classList.toggle("hidden", activeStatus !== "review");
  el("marketStage").classList.toggle("hidden", activeStatus !== "market");
  el("scriptStage").classList.toggle("hidden", activeStatus !== "script");
  el("visualStage").classList.toggle("hidden", activeStatus !== "visual");
  el("exportStage").classList.toggle("hidden", activeStatus !== "export");

  if (activeStatus === "review") fillReviewForm(project.visionAnalysis);
  if (activeStatus === "market") {
    fillMarketForm(project);
    renderMarketProductSummary(project);
  }
  if (activeStatus === "script") renderScriptStage(project);
  if (activeStatus === "visual") renderVisualStage(project);
  if (activeStatus === "export") renderExportStage(project);
  if (project.reviewConfirmedAt) {
    el("confirmedTime").textContent = `确认时间：${formatTime(project.reviewConfirmedAt)}`;
  }

  lockStageForReview(isReviewingPast);
  el("saveState").textContent = isReviewingPast
    ? `正在回看：${statusLabel(activeStatus)}`
    : "已保存到本机";
}

export function renderStepper(activeStatus = viewStatus()) {
  const current = Math.max(0, STAGE_ORDER.indexOf(state.project.status));
  const active = Math.max(0, STAGE_ORDER.indexOf(activeStatus));
  document.querySelectorAll("#stepper li").forEach((item, index) => {
    const reached = index <= current;
    item.classList.toggle("active", index === active);
    item.classList.toggle("complete", index < current);
    item.classList.toggle("available", reached);
    item.classList.toggle("unavailable", !reached);
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", reached ? "0" : "-1");
    item.setAttribute("aria-disabled", reached ? "false" : "true");
  });
}

export function renderAssets() {
  const assets = state.project?.assets || [];
  el("assetGrid").innerHTML = assets.map((asset) => `
    <article class="asset-card">
      <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.name)}">
      <span>${escapeHtml(asset.name)}</span>
    </article>
  `).join("");
  el("assetHint").textContent = assets.length
    ? `已上传 ${assets.length} 张图片。确认都属于同一款鞋后开始识别。`
    : "至少上传一张图片后才能开始识别。";
  el("analyzeButton").disabled = state.busy || !assets.length;
}

export function canViewStep(step) {
  return isStageReached(step);
}

function lockStageForReview(value) {
  document.querySelectorAll(".stage-view.readonly-stage").forEach((stage) => {
    stage.classList.remove("readonly-stage");
  });
  document.querySelectorAll("[data-review-locked='true']").forEach((control) => {
    if ("disabled" in control) control.disabled = control.dataset.wasDisabled === "true";
    if ("readOnly" in control) control.readOnly = control.dataset.wasReadonly === "true";
    delete control.dataset.reviewLocked;
    delete control.dataset.wasDisabled;
    delete control.dataset.wasReadonly;
  });

  if (!value) return;
  const visibleStage = document.querySelector(".stage-card .stage-view:not(.hidden)");
  if (!visibleStage) return;

  visibleStage.classList.add("readonly-stage");
  visibleStage.querySelectorAll("button, input, textarea, select").forEach((control) => {
    control.dataset.reviewLocked = "true";
    control.dataset.wasDisabled = String(control.disabled);
    control.dataset.wasReadonly = String(control.readOnly);
    if ("disabled" in control) control.disabled = true;
    if ("readOnly" in control) control.readOnly = true;
  });
}

function renderCompletionList(status) {
  const itemsByStatus = {
    assets: ["图片属于同一款鞋", "关键角度足够清晰", "产品外观可以稳定锁定"],
    analyzing: ["等待识别完成", "保留原始素材", "准备进入人工审核"],
    review: ["产品概况已检查", "外观身份已修正", "必须保持和禁止修改项已确认"],
    market: ["目标国家已选择", "目标人群已确认", "创意主题、核心信息和语气已填写"],
    script: ["市场 brief 已保存", "脚本阶段可以读取创意方向", "如需修改可返回市场创意"],
    visual: ["脚本已确认", "故事板方向清晰", "关键帧要求准备完成"],
    export: ["视觉资产已确认", "交付文件已整理", "Flow Omni 包可导出"]
  };
  const items = itemsByStatus[status] || itemsByStatus.assets;
  el("completionList").innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function listText(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function displayValue(value) {
  if (Array.isArray(value)) return value.length ? value.join("、") : "未识别";
  return value || "未识别";
}

function optionLabels(options, selectedValue) {
  return options.map(([value, label, description]) => `
    <label class="choice-card compact-choice">
      <input type="radio" name="${options === creativeThemeOptions ? "creativeTheme" : "tone"}"
        value="${escapeHtml(value)}" ${value === selectedValue ? "checked" : ""}>
      <span>
        <strong>${escapeHtml(label)}</strong>
        ${description ? `<small>${escapeHtml(description)}</small>` : ""}
      </span>
    </label>
  `).join("");
}

function aspectLabels(selectedValue) {
  return aspectRatioOptions.map(([value, label]) => `
    <label class="aspect-option" title="${escapeHtml(label)}">
      <input type="radio" name="output_aspect_ratio"
        value="${escapeHtml(value)}" ${value === selectedValue ? "checked" : ""}>
      <span class="aspect-icon" style="--ratio:${escapeHtml(value.replace(":", " / "))}"></span>
      <b>${escapeHtml(value)}</b>
      <small>${escapeHtml(label)}</small>
    </label>
  `).join("");
}

function renderAutoAnalysisSummary(analysis) {
  const lock = analysis?.product_lock_manifest || {};
  const rows = [
    ["鞋款", valueAt(analysis, "product_summary.shoe_type")],
    ["用途", valueAt(analysis, "product_summary.likely_usage.value")],
    ["风格", valueAt(analysis, "product_summary.overall_style")],
    ["颜色", displayValue(lock.main_colors)],
    ["材质", lock.upper_material_visible],
    ["鞋底", [lock.midsole_shape, lock.outsole_color, lock.outsole_pattern].filter(Boolean).join("；")]
  ];
  return `
    <div class="auto-analysis-grid">
      ${rows.map(([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(displayValue(value))}</dd>
        </div>
      `).join("")}
    </div>
  `;
}

export function fillReviewForm(analysis) {
  const form = el("reviewForm");
  const lock = analysis?.product_lock_manifest || {};
  const setup = projectSetup(state.project);
  form.elements.shoe_type.value = valueAt(analysis, "product_summary.shoe_type");
  form.elements.likely_usage.value = valueAt(analysis, "product_summary.likely_usage.value");
  form.elements.overall_style.value = valueAt(analysis, "product_summary.overall_style");
  form.elements.main_colors.value = (lock.main_colors || []).join(", ");
  form.elements.supporting_colors.value = (lock.supporting_colors || []).join(", ");
  form.elements.upper_material_visible.value = lock.upper_material_visible || "";
  form.elements.toe_and_lace.value = [lock.toe_shape, lock.lace_system].filter(Boolean).join("\n");
  form.elements.sole_structure.value = [
    lock.midsole_shape,
    lock.outsole_color,
    lock.outsole_pattern
  ].filter(Boolean).join("\n");
  form.elements.side_and_heel.value = [
    lock.side_pattern_or_logo,
    lock.heel_structure
  ].filter(Boolean).join("\n");
  form.elements.must_keep.value = listText(lock.must_keep);
  form.elements.must_not_change.value = listText(lock.must_not_change);
  el("countryOptions").innerHTML = marketCountryOptions.map(([value, label]) => `
    <option value="${escapeHtml(value)}">${escapeHtml(label)}</option>
  `).join("");
  form.elements.targetCountry.value = setup.targetCountry;
  form.elements.audience.value = setup.audience;
  el("aspectOptions").innerHTML = aspectLabels(setup.outputAspectRatio);
  el("creativeThemeOptions").innerHTML = optionLabels(creativeThemeOptions, setup.creativeTheme);
  el("toneOptions").innerHTML = optionLabels(toneOptions, setup.tone);
  el("autoAnalysisSummary").innerHTML = renderAutoAnalysisSummary(analysis);
  el("mustKeepPreview").textContent = displayValue(lock.must_keep);
  el("mustNotChangePreview").textContent = displayValue(lock.must_not_change);
  el("analysisMode").textContent = analysis?.mode === "api"
    ? "AI 识别 · 待审核"
    : "演示识别 · 请修改";

  const warnings = analysis?.image_quality?.missing_or_unclear || [];
  const notes = analysis?.image_quality?.notes || [];
  el("qualityNote").textContent = [...warnings, ...notes].join("；");
}

export function analysisFromForm() {
  const form = el("reviewForm");
  const previous = state.project.visionAnalysis || {};
  const targetCountry = form.elements.targetCountry?.value || "Thailand";
  const audience = form.elements.audience?.value || "日常运动与通勤人群";
  const outputAspectRatio = form.elements.output_aspect_ratio?.value || "9:16";
  const creativeTheme = form.elements.creativeTheme?.value || "city-motion";
  const tone = form.elements.tone?.value || "energetic";
  const toeAndLace = lines(form.elements.toe_and_lace.value);
  const sole = lines(form.elements.sole_structure.value);
  const sideAndHeel = lines(form.elements.side_and_heel.value);
  saveProjectPreferences(state.project, {
    targetCountry,
    audience,
    outputAspectRatio,
    creativeTheme,
    tone
  });
  el("briefCountry").value = countryNames[targetCountry] || targetCountry;
  el("briefAudience").value = audience;
  el("briefAspect").value = outputAspectRatio;

  return {
    ...previous,
    mode: "reviewed",
    product_summary: {
      shoe_type: form.elements.shoe_type.value,
      likely_usage: {
        value: form.elements.likely_usage.value,
        evidence: valueAt(previous, "product_summary.likely_usage.evidence", "unknown")
      },
      overall_style: form.elements.overall_style.value
    },
    product_lock_manifest: {
      main_colors: lines(form.elements.main_colors.value),
      supporting_colors: lines(form.elements.supporting_colors.value),
      upper_material_visible: form.elements.upper_material_visible.value,
      toe_shape: toeAndLace[0] || "",
      lace_system: toeAndLace.slice(1).join("；"),
      midsole_shape: sole[0] || "",
      outsole_color: sole[1] || "",
      outsole_pattern: sole.slice(2).join("；"),
      side_pattern_or_logo: sideAndHeel[0] || "",
      heel_structure: sideAndHeel.slice(1).join("；"),
      must_keep: lines(form.elements.must_keep.value),
      must_not_change: lines(form.elements.must_not_change.value)
    }
  };
}

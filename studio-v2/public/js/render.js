import {
  aspectRatioOptions,
  audienceOptions,
  creativeThemeOptions,
  countryNames,
  el,
  escapeHtml,
  formatTime,
  lines,
  marketCountryOptions,
  projectSetup,
  readProjectPreferences,
  saveProjectPreferences,
  state,
  statusLabel,
  toneOptions,
  valueAt
} from "./core.js";
import {
  hasReadyStoryboards,
  renderExportStage,
  renderScriptStage,
  renderVisualStage
} from "./demo-loop.js";
import {
  fillMarketForm,
  renderMarketProductSummary
} from "./market.js";

const STAGE_ORDER = ["assets", "review", "market", "script", "visual", "export"];

const STAGE_PANEL_COPY = {
  assets: "先上传清晰的同款鞋素材，后面的识别和锁定才会稳。",
  review: "确认产品锁定、受众、比例和创意方向。",
  market: "把已确认的产品信息整理成脚本输入。",
  script: "按完整 20 秒时间线检查镜头、文案和节奏。",
  visual: "img2img 只生成两张故事板，成功的会保留。",
  export: "只保留两张故事板和对应脚本，方便直接交付。"
};

const STAGE_PANEL_TITLE = {
  assets: "上传进度",
  review: "产品设定",
  market: "创意确认",
  script: "脚本进度",
  visual: "故事板状态",
  export: "最终交付"
};

const VISIBLE_STAGE_NUMBER = {
  assets: 1,
  analyzing: 1,
  review: 2,
  market: 2,
  script: 3,
  visual: 4,
  export: 5
};

function publicQualityNotes(analysis) {
  const notes = [
    ...(analysis?.image_quality?.missing_or_unclear || []),
    ...(analysis?.image_quality?.notes || [])
  ];
  const publicNotes = notes.filter((note) => !/API\s*Key|API\s*URL|模型名|视觉模型/i.test(note));
  if (publicNotes.length !== notes.length) {
    publicNotes.push("供应商未就绪时使用演示识别；可在管理后台查看就绪状态。");
  }
  return publicNotes;
}

function viewStatus() {
  if (!state.project) return "assets";
  if (!state.viewStatus) state.viewStatus = state.project.status;
  return state.viewStatus;
}

function isStageReached(step) {
  if (!state.project) return false;
  if (step === "export" && !hasReadyStoryboards(state.project)) return false;
  const currentStatus = state.project.status === "analyzing" ? "assets" : state.project.status;
  const current = STAGE_ORDER.indexOf(currentStatus);
  const target = STAGE_ORDER.indexOf(step);
  return target >= 0 && target <= current;
}

export function renderProjectList() {
  const container = el("projectList");
  const bulkActions = el("projectBulkActions");
  if (bulkActions) {
    const selectedCount = state.selectedProjectIds.size;
    const allCount = state.projects.length;
    bulkActions.innerHTML = state.projectSelectionMode
      ? `
        <button class="sidebar-tool-button" type="button" data-project-select-all
          ${allCount ? "" : "disabled"}>${selectedCount === allCount ? "清空" : "全选"}</button>
        <button class="sidebar-tool-button danger" type="button" data-project-bulk-delete
          ${selectedCount ? "" : "disabled"}>删除 ${selectedCount}</button>
        <button class="sidebar-tool-button" type="button" data-project-bulk-cancel>取消</button>
      `
      : `
        <button class="sidebar-tool-button" type="button" data-project-bulk-start
          ${state.projects.length > 1 ? "" : "disabled"}>批量清理旧项目</button>
      `;
  }
  if (!state.projects.length) {
    container.innerHTML = `<div class="project-link"><small>还没有项目</small></div>`;
    return;
  }
  container.innerHTML = state.projects.map((project) => `
    <div class="project-item ${project.id === state.project?.id ? "active" : ""}">
      ${state.projectSelectionMode ? `
        <label class="project-select">
          <input type="checkbox" data-project-select-id="${escapeHtml(project.id)}"
            ${state.selectedProjectIds.has(project.id) ? "checked" : ""}>
          <span class="sr-only">选择 ${escapeHtml(project.name)}</span>
        </label>
      ` : ""}
      <button class="project-link"
        data-project-id="${escapeHtml(project.id)}" type="button">
        <strong>${escapeHtml(project.name)}</strong>
        <small>${statusLabel(project.status)} · ${formatTime(project.updatedAt)}</small>
      </button>
      <button class="project-delete" data-delete-project-id="${escapeHtml(project.id)}"
        type="button" ${state.deletingProjectIds.has(project.id) ? "disabled" : ""}
        aria-label="删除 ${escapeHtml(project.name)}">
        ${state.deletingProjectIds.has(project.id) ? "…" : "×"}
      </button>
    </div>
  `).join("");
}

export function renderWorkspace() {
  const project = state.project;
  if (!project) return;
  const activeStatus = viewStatus();
  const needsStoryboardCompletion = project.status === "export" && activeStatus === "visual" && !hasReadyStoryboards(project);
  const isReviewingPast = !needsStoryboardCompletion && activeStatus !== project.status && isStageReached(activeStatus);

  el("projectTitle").textContent = project.name;
  el("projectState").textContent = isReviewingPast
    ? `${statusLabel(project.status)} · 回看${statusLabel(activeStatus)}`
    : statusLabel(project.status);
  const subtitleByStatus = {
    assets: "先上传清晰素材，再进入识别和锁定。",
    analyzing: "正在识别鞋款，稍后会进入产品设定。",
    review: "确认产品信息、受众、比例和创意方向。",
    market: "整理创意 brief，准备生成两段脚本。",
    script: "查看完整 20 秒中文脚本，按时间顺序检查镜头与文案。",
    visual: "img2img 只生成两张故事板。",
    export: "最终页只保留两张故事板和对应脚本。"
  };
  el("workspaceSubtitle").textContent = subtitleByStatus[activeStatus] || subtitleByStatus.assets;
  const setup = projectSetup(project);
  const briefCountry = el("briefCountry");
  const briefAudience = el("briefAudience");
  const briefAspect = el("briefAspect");
  if (briefCountry) briefCountry.value = countryNames[setup.targetCountry] || setup.targetCountry || "";
  if (briefAudience) briefAudience.value = setup.audience || "";
  if (briefAspect) briefAspect.value = setup.outputAspectRatio;

  renderAssets();
  renderStepper(activeStatus);
  renderCompletionList(activeStatus);
  renderWorkspacePanel(project, activeStatus);

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
  renderProductionExperience(activeStatus);
  if (project.reviewConfirmedAt) {
    el("confirmedTime").textContent = `确认时间：${formatTime(project.reviewConfirmedAt)}`;
  }

  lockStageForReview(isReviewingPast);
}

function renderProductionExperience(activeStatus) {
  const visibleStep = VISIBLE_STAGE_NUMBER[activeStatus] || 1;
  const workspace = el("workspace");
  const stageChanged = workspace.dataset.renderedStage !== activeStatus;
  workspace.dataset.stage = activeStatus;
  workspace.dataset.status = state.project?.status || activeStatus;
  workspace.dataset.renderedStage = activeStatus;
  if (stageChanged) {
    workspace.classList.remove("production-enter");
    requestAnimationFrame(() => workspace.classList.add("production-enter"));
  }

  el("productionSceneLabel").textContent = `SCENE ${String(visibleStep).padStart(2, "0")} / 05`;
}

function renderWorkspacePanel(project, activeStatus) {
  const assets = project.assets || [];
  const totalSteps = 5;
  const visibleStep = VISIBLE_STAGE_NUMBER[activeStatus] || 1;
  const progressStep = visibleStep;
  const workflowProgress = state.workflowProgress;
  const completedPercent = workflowProgress?.active && workflowProgress.stage === activeStatus
    ? workflowProgress.percent
    : activeStatus === "export"
    ? 100
    : Math.max(10, Math.min(100, Math.round((progressStep / totalSteps) * 100)));
  const readinessText = (() => {
    if (activeStatus !== "assets" && activeStatus !== "analyzing") return `${statusLabel(activeStatus)} 已进入后续流程`;
    if (!assets.length) return "等待上传素材";
    if (assets.length < 4) return `已上传 ${assets.length} 张，建议继续补充`;
    return `已上传 ${assets.length} 张，可以开始识别`;
  })();
  const panelStageKicker = el("panelStageKicker");
  const panelStageTitle = el("panelStageTitle");
  const panelStageCopy = el("panelStageCopy");
  const panelAssetCount = el("panelAssetCount");
  const panelWorkflowState = el("panelWorkflowState");
  const panelProgressBar = el("panelProgressBar");
  const panelProgressText = el("panelProgressText");
  if (panelStageKicker) panelStageKicker.textContent = `STEP 0${visibleStep}`;
  if (panelStageTitle) panelStageTitle.textContent = STAGE_PANEL_TITLE[activeStatus] || "工作进度";
  if (panelStageCopy) panelStageCopy.textContent = STAGE_PANEL_COPY[activeStatus] || "";
  if (panelAssetCount) panelAssetCount.textContent = `${assets.length} 张`;
  if (panelWorkflowState) panelWorkflowState.textContent = statusLabel(activeStatus);
  if (panelProgressBar) panelProgressBar.style.width = `${completedPercent}%`;
  if (panelProgressText) panelProgressText.textContent = workflowProgress?.active && workflowProgress.stage === activeStatus
    ? workflowProgress.message
    : readinessText;
}

export function renderStepper(activeStatus = viewStatus()) {
  const active = Math.max(0, STAGE_ORDER.indexOf(activeStatus));
  document.querySelectorAll("#stepper li").forEach((item, index) => {
    const reached = isStageReached(item.dataset.step);
    const current = Math.max(0, STAGE_ORDER.indexOf(state.project.status));
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
  const project = state.project;
  const assets = state.project?.assets || [];
  const canUpload = project?.status === "assets" && !state.busy;
  el("assetGrid").innerHTML = assets.map((asset) => `
    <article class="asset-card">
      <div class="asset-card-actions">
        <button class="asset-icon-button danger" type="button"
          data-delete-asset-id="${escapeHtml(asset.id)}" aria-label="删除 ${escapeHtml(asset.name)}"
          ${canUpload ? "" : "disabled"}>×</button>
      </div>
      <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.name)}">
      <span>${escapeHtml(asset.name)}</span>
    </article>
  `).join("");
  el("assetHint").textContent = project?.status !== "assets"
    ? "当前项目已进入后续步骤，素材已锁定；如需上传新鞋图，请新建项目。"
    : assets.length >= 4
      ? `已上传 ${assets.length} 张图片。第四张检查点已完成，可以开始识别。`
      : `已上传 ${assets.length} 张，还需 ${4 - assets.length} 张参考图才能开始识别。`;
  el("dropZone").disabled = !canUpload;
  el("fileInput").disabled = !canUpload;
  el("analyzeButton").disabled = state.busy || assets.length < 4;
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
    if (control.matches('[data-preview-image], [data-copy-target], [data-action="view-export"], [data-action="view-visual"]')) {
      return;
    }
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
    review: ["目标人群和尺寸已选择", "创意方向和核心信息已整理", "产品锁定已确认"],
    market: ["目标国家已选择", "目标人群已确认", "创意主题、核心信息和语气已填写"],
    script: ["完整 20 秒脚本已生成", "全部镜头按时间顺序可审核", "确认后按两个 10 秒分段生成故事板"],
    visual: ["脚本已确认", "故事板方向清晰", "准备生成两张分段故事板"],
    export: ["两张故事板已整理", "两段 10 秒脚本可复制", "第一版交付内容已就绪"]
  };
  const items = itemsByStatus[status] || itemsByStatus.assets;
  if (status === "visual") {
    const ratio = state.project?.marketBrief?.outputAspectRatio || "9:16";
    const entries = (state.project?.imagePackage?.image_generation || []).filter((item) =>
      item.type === "storyboard_board" && item.aspect_ratio === ratio
    );
    const complete = entries.filter((item) => item.status === "done" && item.generated_image?.url).length;
    items[1] = `故事板完成 ${complete}/2`;
    items[2] = complete === 2 ? "可进入最终交付" : "成功图片保留，缺失项可继续生成";
  }
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

export function updateAspectSummary(value) {
  const option = aspectRatioOptions.find(([item]) => item === value) || aspectRatioOptions[0];
  const [ratio, label] = option;
  const form = el("reviewForm");
  if (form?.elements.output_aspect_ratio) form.elements.output_aspect_ratio.value = ratio;
  const icon = el("aspectSummaryIcon");
  if (icon) icon.style.setProperty("--ratio", ratio.replace(":", " / "));
  if (el("aspectSummaryValue")) el("aspectSummaryValue").textContent = ratio;
  if (el("aspectSummaryLabel")) el("aspectSummaryLabel").textContent = label;
}

function labelFor(options, value, fallback = "") {
  return options.find(([item]) => item === value)?.[1] || fallback || value || "";
}

function compactOptionsHtml(name, options, selectedValue, { valueAsLabel = false, withIcons = false } = {}) {
  return options.map(([value, label, description]) => {
    const selected = String(value) === String(selectedValue);
    const icon = withIcons
      ? `<span class="aspect-icon" style="--ratio:${escapeHtml(String(value).replace(":", " / "))}"></span>`
      : "";
    return `
      <button class="review-option ${selected ? "selected" : ""}" type="button"
        data-review-select="${escapeHtml(name)}"
        data-value="${escapeHtml(value)}"
        data-label="${escapeHtml(valueAsLabel ? value : label)}">
        ${icon}
        <strong>${escapeHtml(valueAsLabel ? value : label)}</strong>
        ${description ? `<small>${escapeHtml(description)}</small>` : ""}
      </button>
    `;
  }).join("");
}

function renderReviewControls(setup) {
  const container = el("reviewControlBox");
  if (!container) return;
  const countryLabel = countryNames[setup.targetCountry] || setup.targetCountry;
  const themeLabel = labelFor(creativeThemeOptions, setup.creativeTheme);
  const toneLabel = labelFor(toneOptions, setup.tone);
  const modifiedSettings = new Set(readProjectPreferences(state.project).modifiedSettings || []);
  const groups = [
    {
      name: "targetCountry",
      icon: "地",
      label: "国家",
      value: countryLabel,
      options: compactOptionsHtml("targetCountry", marketCountryOptions, setup.targetCountry)
    },
    {
      name: "audience",
      icon: "众",
      label: "人群",
      value: setup.audience,
      options: compactOptionsHtml("audience", audienceOptions.map(([value, label, description]) => [label, label, description]), setup.audience)
    },
    {
      name: "output_aspect_ratio",
      icon: "幅",
      label: "尺寸",
      value: setup.outputAspectRatio,
      options: compactOptionsHtml("output_aspect_ratio", aspectRatioOptions, setup.outputAspectRatio, { valueAsLabel: true, withIcons: true })
    },
    {
      name: "creativeTheme",
      icon: "题",
      label: "主题",
      value: themeLabel,
      options: compactOptionsHtml("creativeTheme", creativeThemeOptions, setup.creativeTheme)
    },
    {
      name: "tone",
      icon: "调",
      label: "语气",
      value: toneLabel,
      options: compactOptionsHtml("tone", toneOptions, setup.tone)
    },
    {
      name: "shotsPerSegment",
      icon: "镜",
      label: "镜头",
      value: `${setup.shotsPerSegment} 个`,
      options: compactOptionsHtml("shotsPerSegment", [[3, "3 个", "每 10 秒"], [4, "4 个", "每 10 秒"], [5, "5 个", "每 10 秒"]], setup.shotsPerSegment)
    }
  ];
  container.innerHTML = groups.map((group) => `
    <div class="review-menu" data-review-menu-root="${escapeHtml(group.name)}">
      <button class="review-chip" type="button" data-review-menu="${escapeHtml(group.name)}" aria-expanded="false">
        <i aria-hidden="true">${escapeHtml(group.icon)}</i>
        <span>
          <small>${escapeHtml(group.label)}</small>
          <strong>${escapeHtml(group.value)}</strong>
          <em class="setting-origin ${modifiedSettings.has(group.name) ? "modified" : "recommended"}">
            ${modifiedSettings.has(group.name) ? "用户已修改" : "AI 建议"}
          </em>
        </span>
        <b>⌄</b>
      </button>
      <div class="review-popover hidden" data-review-panel="${escapeHtml(group.name)}">
        ${group.options}
      </div>
    </div>
  `).join("");
}

function renderProductLockCard(analysis) {
  const container = el("productLockCard");
  if (!container) return;
  const lock = analysis?.product_lock_manifest || {};
  const confidence = lock.confidence || analysis?.confidence || analysis?.product_summary?.confidence;
  const heroAsset = state.project?.assets?.[0]?.url;
  const rows = [
    ["产品类型", valueAt(analysis, "product_summary.shoe_type")],
    ["主色", displayValue(lock.main_colors)],
    ["鞋型轮廓", [lock.toe_shape, lock.lace_system].filter(Boolean).join("；")],
    ["鞋底 / 外底", [lock.midsole_shape, lock.outsole_color, lock.outsole_pattern].filter(Boolean).join("；")],
    ["材质 / 纹理", lock.upper_material_visible],
    ["Logo / 图案", [lock.side_pattern_or_logo, lock.heel_structure].filter(Boolean).join("；")],
    ["必须保持", displayValue(lock.must_keep)],
    ["禁止修改", displayValue(lock.must_not_change)]
  ];
  container.innerHTML = `
    <div class="product-lock-heading">
      <div><span class="product-lock-icon">锁</span><div><small>PRODUCT LOCK</small><h3>产品身份锁定</h3></div></div>
      <span class="lock-confidence">${confidence ? `置信度 ${escapeHtml(confidence)}` : "人工确认前"}</span>
    </div>
    <div class="product-lock-layout">
      ${heroAsset ? `<div class="product-lock-visual"><img src="${escapeHtml(heroAsset)}" alt="产品锁定主参考图"><span>MASTER REFERENCE</span></div>` : ""}
      <div class="product-lock-grid">
        ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(displayValue(value))}</dd></div>`).join("")}
      </div>
    </div>
  `;
}

export function syncReviewSummaries() {
  const form = el("reviewForm");
  if (!form) return;
  const aspectValue = form.elements.output_aspect_ratio?.value || "9:16";
  updateAspectSummary(aspectValue);
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
  const hasAnalysis = Boolean(analysis);
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
  form.elements.targetCountry.value = setup.targetCountry;
  form.elements.audience.value = setup.audience;
  form.elements.output_aspect_ratio.value = setup.outputAspectRatio;
  form.elements.creativeTheme.value = setup.creativeTheme;
  form.elements.tone.value = setup.tone;
  form.elements.shotsPerSegment.value = setup.shotsPerSegment;
  updateAspectSummary(setup.outputAspectRatio);
  renderReviewControls(setup);
  if (form.elements.coreMessage && !form.elements.coreMessage.value) {
    form.elements.coreMessage.value = setup.coreMessage;
  }
  syncReviewSummaries();
  el("autoAnalysisSummary").innerHTML = renderAutoAnalysisSummary(analysis);
  renderProductLockCard(analysis);
  el("mustKeepPreview").textContent = displayValue(lock.must_keep);
  el("mustNotChangePreview").textContent = displayValue(lock.must_not_change);
  el("analysisMode").textContent = analysis?.mode === "api"
    ? "AI 识别 · 待审核"
    : hasAnalysis
      ? "演示识别 · 请修改"
      : "正在识别 · 请稍候";
  const hasCheckpoint = (state.project?.assets || []).length >= 4;
  document.querySelectorAll("#reviewForm button[type='submit'], button[form='reviewForm']").forEach((button) => {
    button.disabled = !hasAnalysis || !hasCheckpoint || state.busy;
  });
  const gateHint = el("reviewGateHint");
  if (gateHint) {
    gateHint.textContent = hasCheckpoint
      ? "第四张参考图检查点已完成，确认后进入脚本。"
      : `还需 ${Math.max(0, 4 - (state.project?.assets || []).length)} 张参考图；当前不能进入脚本。`;
    gateHint.classList.toggle("ready", hasCheckpoint);
  }

  el("qualityNote").textContent = publicQualityNotes(analysis).join("；");
}

export function analysisFromForm() {
  const form = el("reviewForm");
  const previous = state.project.visionAnalysis || {};
  const targetCountry = form.elements.targetCountry?.value || "Thailand";
  const audience = form.elements.audience?.value || "日常运动与通勤人群";
  const outputAspectRatio = form.elements.output_aspect_ratio?.value || "9:16";
  const creativeTheme = form.elements.creativeTheme?.value || "city-motion";
  const tone = form.elements.tone?.value || "energetic";
  const rawCoreMessage = form.elements.coreMessage?.value.trim() || "";
  const shotsPerSegment = Number(form.elements.shotsPerSegment?.value || 5);
  const toeAndLace = lines(form.elements.toe_and_lace.value);
  const sole = lines(form.elements.sole_structure.value);
  const sideAndHeel = lines(form.elements.side_and_heel.value);
  const preferences = {
    targetCountry,
    audience,
    outputAspectRatio,
    creativeTheme,
    tone,
    shotsPerSegment: [3, 4, 5].includes(shotsPerSegment) ? shotsPerSegment : 5
  };
  if (rawCoreMessage) preferences.coreMessage = rawCoreMessage;
  saveProjectPreferences(state.project, preferences);
  const briefCountry = el("briefCountry");
  const briefAudience = el("briefAudience");
  const briefAspect = el("briefAspect");
  if (briefCountry) briefCountry.value = countryNames[targetCountry] || targetCountry;
  if (briefAudience) briefAudience.value = audience;
  if (briefAspect) briefAspect.value = outputAspectRatio;

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

function autoCoreMessage(analysis, audience) {
  const summary = analysis?.product_summary || {};
  const lock = analysis?.product_lock_manifest || {};
  const colors = Array.isArray(lock.main_colors) && lock.main_colors.length
    ? `${lock.main_colors.slice(0, 2).join("、")} 配色`
    : "清晰鞋型";
  const usage = summary.likely_usage?.value || "日常出行";
  return `${colors}，适合${audience || usage}的轻快稳定穿搭。`;
}

export function marketBriefFromReviewForm() {
  const form = el("reviewForm");
  const setup = projectSetup(state.project);
  const targetCountry = form.elements.targetCountry?.value || setup.targetCountry;
  const audience = form.elements.audience?.value || setup.audience;
  const creativeTheme = form.elements.creativeTheme?.value || setup.creativeTheme;
  const tone = form.elements.tone?.value || setup.tone;
  const rawCoreMessage = form.elements.coreMessage?.value.trim() || "";
  const coreMessage = rawCoreMessage || autoCoreMessage(state.project?.visionAnalysis, audience);
  const shotsPerSegment = Number(form.elements.shotsPerSegment?.value || setup.shotsPerSegment);
  const preferences = {
    targetCountry,
    audience,
    outputAspectRatio: form.elements.output_aspect_ratio?.value || setup.outputAspectRatio,
    creativeTheme,
    tone,
    shotsPerSegment: [3, 4, 5].includes(shotsPerSegment) ? shotsPerSegment : 5
  };
  if (rawCoreMessage) preferences.coreMessage = rawCoreMessage;
  saveProjectPreferences(state.project, preferences);
  return {
    targetCountry,
    audience,
    creativeTheme,
    coreMessage,
    tone,
    outputAspectRatio: form.elements.output_aspect_ratio?.value || setup.outputAspectRatio
  };
}

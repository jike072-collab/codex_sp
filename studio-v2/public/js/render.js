import {
  aspectRatioOptions,
  audienceOptions,
  creativeThemeOptions,
  countryNames,
  el,
  escapeHtml,
  formatTime,
  isSingleVideoProject,
  lines,
  marketCountryOptions,
  projectSetup,
  readProjectPreferences,
  saveProjectPreferences,
  state,
  statusLabel,
  toneOptions,
  valueAt,
  videoDurationOptions,
  workflowMode,
  workflowModeOptions,
  workflowModeLabel
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
  assets: "上传 1 张图片即可开始识别，4-8 张多角度素材会让后续画面更稳。",
  review: "检查产品身份、投放设置和创意方向，确认后进入脚本。",
  market: "把已确认的产品信息整理成脚本输入。",
  script: "检查脚本结构、镜头节奏、字幕和卖点是否完整。",
  visual: "检查故事版生成数量、画面清晰度和重试状态。",
  export: "汇总故事版、脚本和视频生成任务，准备视频交付。"
};

const STAGE_PANEL_TITLE = {
  assets: "AI 素材检测器",
  review: "AI 产品检查器",
  market: "创意确认",
  script: "AI 脚本检查官",
  visual: "AI 故事版检查",
  export: "生成视频"
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

const PROJECT_STATUS_DOT = {
  assets: "素材",
  analyzing: "识别",
  review: "待确认",
  market: "已设定",
  script: "脚本",
  visual: "故事版",
  export: "视频"
};

function publicQualityNotes(analysis) {
  const notes = [
    ...(analysis?.image_quality?.missing_or_unclear || []),
    ...(analysis?.image_quality?.notes || [])
  ];
  const publicNotes = notes.filter((note) => !/API\s*Key|API\s*URL|模型名|视觉模型/i.test(note));
  if (publicNotes.length !== notes.length) {
    publicNotes.push("当前使用演示识别；如需真实识别，可请管理员完成后台配置。");
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
  container.innerHTML = state.projects.map((project, index) => {
    const assetCount = (project.assets || []).length;
    const projectNo = project.name || `项目 ${String(index + 1).padStart(2, "0")}`;
    const stateText = statusLabel(project.status);
    const metaText = `${workflowModeLabel(workflowMode(project))} · ${assetCount} 张素材`;
    return `
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
        <span class="project-link-head">
          <strong>${escapeHtml(projectNo)}</strong>
          <em>${escapeHtml(PROJECT_STATUS_DOT[project.status] || stateText)}</em>
        </span>
        <small>${escapeHtml(metaText)}</small>
        <time>${escapeHtml(formatTime(project.updatedAt))}</time>
      </button>
      <button class="project-delete" data-delete-project-id="${escapeHtml(project.id)}"
        type="button" ${state.deletingProjectIds.has(project.id) ? "disabled" : ""}
        aria-label="删除 ${escapeHtml(project.name)}">
        ${state.deletingProjectIds.has(project.id) ? "…" : "×"}
      </button>
    </div>
  `;
  }).join("");
}

export function renderWorkspace() {
  const project = state.project;
  if (!project) return;
  const activeStatus = viewStatus();
  const needsStoryboardCompletion = project.status === "export" && activeStatus === "visual" && !hasReadyStoryboards(project);
  const isReviewingPast = !needsStoryboardCompletion && activeStatus !== project.status && isStageReached(activeStatus);

  const projectTitle = el("projectTitle");
  projectTitle.textContent = project.name || "未命名项目";
  projectTitle.hidden = false;
  el("projectState").innerHTML = renderWorkflowModeSwitcher(project);
  el("projectState").setAttribute(
    "aria-label",
    `${isReviewingPast ? `${statusLabel(project.status)}，回看${statusLabel(activeStatus)}，` : ""}当前模式：${workflowModeLabel(workflowMode(project))}`
  );
  const subtitleByStatus = {
    assets: "第一步上传商品素材，1 张即可开始识别，4-8 张多角度素材更稳。",
    analyzing: "正在识别鞋款，稍后会进入产品设定。",
    review: "确认产品信息、受众、比例和创意方向。",
    market: "整理创意 brief，准备生成单条视频脚本。",
    script: isSingleVideoProject(project)
      ? "查看完整中文脚本，按所选时长检查镜头与文案。"
      : "查看 20 秒中文脚本，按两个 10 秒段落检查镜头与文案。",
    visual: isSingleVideoProject(project)
      ? "生成一张完整故事版，成功后进入视频页。"
      : "生成两张 10 秒分段故事版，成功后进入视频页。",
    export: isSingleVideoProject(project)
      ? "检查视频任务，完成后可播放和下载广告视频。"
      : "检查两个 10 秒视频任务，完成后可播放和下载。"
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

function renderWorkflowModeSwitcher(project) {
  const currentMode = workflowMode(project);
  return `
    <span class="workflow-mode-switch" role="group" aria-label="项目模式">
      ${workflowModeOptions.map(([mode, label]) => `
        <button class="workflow-mode-option ${mode === currentMode ? "active" : ""}" type="button"
          data-workflow-mode="${escapeHtml(mode)}"
          aria-pressed="${mode === currentMode ? "true" : "false"}"
          ${state.busy ? "disabled" : ""}>
          ${escapeHtml(label)}
        </button>
      `).join("")}
    </span>
  `;
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
    if (assets.length === 1) return "已上传 1 张，可以开始识别";
    return `已上传 ${assets.length} 张，可以开始识别`;
  })();
  const panelStageKicker = el("panelStageKicker");
  const panelStageTitle = el("panelStageTitle");
  const panelStageCopy = el("panelStageCopy");
  const panelAssetCount = el("panelAssetCount");
  const panelWorkflowState = el("panelWorkflowState");
  const panelProgressBar = el("panelProgressBar");
  const panelProgressText = el("panelProgressText");
  const panelReadyState = el("panelReadyState");
  const panelReadyCard = el("panelReadyCard");
  const panelTipList = el("panelTipList");
  const panelCard = document.querySelector(".panel-card.panel-overview");
  if (panelCard) panelCard.dataset.stage = activeStatus;
  if (panelStageKicker) panelStageKicker.textContent = `STEP 0${visibleStep}`;
  if (panelStageTitle) panelStageTitle.textContent = STAGE_PANEL_TITLE[activeStatus] || "工作进度";
  if (panelStageCopy) {
    const singleVideo = isSingleVideoProject(project);
    const dynamicCopy = {
      script: singleVideo ? "检查单条脚本的镜头、卖点、字幕和节奏。" : "按 0-10s 和 10-20s 检查脚本、镜头和文案。",
      visual: singleVideo ? "检查完整故事版是否生成成功，失败时可重试。" : "检查两张分段故事版，成功内容会保留。",
      export: singleVideo ? "使用脚本和故事版生成广告视频。" : "使用两张故事版生成两个 10 秒视频任务。"
    };
    panelStageCopy.textContent = dynamicCopy[activeStatus] || STAGE_PANEL_COPY[activeStatus] || "";
  }
  if (panelAssetCount) panelAssetCount.textContent = `${assets.length} 张`;
  if (panelWorkflowState) panelWorkflowState.textContent = statusLabel(activeStatus);
  if (panelProgressBar) panelProgressBar.style.width = `${completedPercent}%`;
  if (panelProgressText) panelProgressText.textContent = workflowProgress?.active && workflowProgress.stage === activeStatus
    ? workflowProgress.message
    : readinessText;
  const readiness = panelReadiness(project, activeStatus);
  if (panelReadyState) panelReadyState.textContent = readiness.label;
  if (panelReadyCard) panelReadyCard.dataset.ready = readiness.ready ? "true" : "false";
  if (panelTipList) {
    panelTipList.innerHTML = panelTips(project, activeStatus)
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
  }
  renderPanelStageVisual(project, activeStatus);
}

function panelReadiness(project, activeStatus) {
  const assets = project.assets || [];
  const singleVideo = isSingleVideoProject(project);
  const storyboardTotal = singleVideo ? 1 : 2;
  const storyboardDone = (project.imagePackage?.image_generation || [])
    .filter((item) => item?.status === "done" && item?.generated_image?.url && (
      singleVideo ? item.segment_id === "full" : ["0-10s", "10-20s"].includes(item.segment_id)
    )).length;
  const videoDone = (project.videoPackage?.video_generation || [])
    .filter((item) => item?.status === "done" && item?.generated_video?.url).length;
  const checks = {
    assets: { ready: assets.length >= 1, label: assets.length >= 1 ? "可以识别产品" : "先上传素材" },
    analyzing: { ready: false, label: "正在识别" },
    review: { ready: Boolean(project.visionAnalysis) && assets.length >= 1, label: project.visionAnalysis ? "可以确认产品" : "等待识别结果" },
    market: { ready: Boolean(project.reviewConfirmedAt), label: project.reviewConfirmedAt ? "可以整理脚本方向" : "先确认产品设定" },
    script: { ready: Boolean(project.planningPackage), label: project.planningPackage ? "可以确认脚本" : "等待脚本生成" },
    visual: { ready: storyboardDone >= storyboardTotal, label: storyboardDone >= storyboardTotal ? "可以进入生成视频" : `故事版 ${storyboardDone}/${storyboardTotal}` },
    export: { ready: videoDone >= (singleVideo ? 1 : 2), label: videoDone ? `视频完成 ${videoDone}/${singleVideo ? 1 : 2}` : "可以开始生成视频" }
  };
  return checks[activeStatus] || checks.assets;
}

function panelTips(project, activeStatus) {
  const singleVideo = isSingleVideoProject(project);
  const tips = {
    assets: ["推荐 4-8 张不同角度清晰图。", "主图、侧面、后跟、鞋底越完整，后续越稳。", "图片背景干净会提升识别效果。"],
    analyzing: ["识别期间不用离开页面。", "识别完成后先检查颜色、鞋型和鞋底。"],
    review: ["先确认产品不被改色、不换鞋型。", "一句话主张可以留空，系统会自动补齐。", "比例和时长会影响后续故事版。"],
    market: ["保持目标人群、主题和主张一致。", "不确定时优先使用默认建议。"],
    script: singleVideo
      ? ["检查每个镜头是否有明确画面和动作。", "确认后会生成一张完整故事版。"]
      : ["检查两个 10 秒段落是否连贯。", "确认后会生成两张分段故事版。"],
    visual: singleVideo
      ? ["单版模式这里只显示一张故事版。", "失败时可以重试，不会覆盖已成功内容。"]
      : ["两张故事版都完成后再进入生成视频。", "可单独重试失败段落。"],
    export: ["生成中保持页面打开更稳。", "成功后可直接预览、下载或重新生成。"]
  };
  return tips[activeStatus] || tips.assets;
}

function panelVideoStatusLabel(status) {
  return {
    waiting: "等待生成",
    submitting: "正在提交",
    queued: "排队中",
    generating: "生成中",
    downloading: "取回视频",
    done: "已完成",
    failed: "生成失败"
  }[status] || "等待生成";
}

function renderPanelStageVisual(project, activeStatus) {
  const container = el("panelStageVisual");
  if (!container) return;
  const assets = project.assets || [];
  const singleVideo = isSingleVideoProject(project);
  const script = singleVideo
    ? project.planningPackage?.script_video?.segment_full || {}
    : project.planningPackage?.script_20s || {};
  const shotCount = singleVideo
    ? (script.shots || []).length
    : [
        ...(script.segment_a_0_10s?.shots || []),
        ...(script.segment_b_10_20s?.shots || [])
      ].length;
  const generated = (project.imagePackage?.image_generation || [])
    .filter((item) => item?.status === "done" && item?.generated_image?.url && (
      singleVideo ? item.segment_id === "full" : ["0-10s", "10-20s"].includes(item.segment_id)
    )).length;

  if (activeStatus === "script") {
    const shots = singleVideo ? (script.shots || []) : [
      ...(script.segment_a_0_10s?.shots || []),
      ...(script.segment_b_10_20s?.shots || [])
    ];
    container.innerHTML = `
      <div class="stage-visual-heading">
        <span>${singleVideo ? "完整时间线" : "20 秒时间线"}</span>
        <strong>${escapeHtml(shotCount || 10)} 镜头</strong>
      </div>
      <div class="script-segment-chart">
        ${singleVideo
          ? `<div><span>完整视频</span><i></i></div>`
          : `<div><span>0-10s</span><i></i></div><div><span>10-20s</span><i></i></div>`}
      </div>
      <div class="shot-tick-chart" aria-hidden="true">
        ${Array.from({ length: shotCount || 10 }, (_, index) => `<i style="--tick:${index}"></i>`).join("")}
      </div>
      ${singleVideo ? `
        <div class="panel-shot-list">
          ${shots.slice(0, 5).map((shot, index) => `
            <div>
              <span>镜头 ${String(index + 1).padStart(2, "0")}</span>
              <strong>${escapeHtml(shot.start_sec ?? index)}-${escapeHtml(shot.end_sec ?? index + 1)}s</strong>
            </div>
          `).join("")}
        </div>
      ` : ""}
      <div class="stage-visual-stats">
        <div><strong>${escapeHtml(singleVideo ? `${project.marketBrief?.videoDurationSeconds || 10}s` : "20s")}</strong><span>总时长</span></div>
        <div><strong>${escapeHtml(singleVideo ? 1 : 2)}</strong><span>交付分段</span></div>
        <div><strong>${escapeHtml(shotCount || 10)}</strong><span>镜头总数</span></div>
      </div>
    `;
    return;
  }

  if (activeStatus === "export") {
    const expectedSegments = singleVideo ? ["full"] : ["0-10s", "10-20s"];
    const videoItems = expectedSegments.map((segmentId) =>
      (project.videoPackage?.video_generation || []).find((item) => item.segment_id === segmentId)
    );
    const completedVideos = videoItems.filter((item) => item?.status === "done" && item?.generated_video?.url).length;
    const failedVideos = videoItems.filter((item) => item?.status === "failed").length;
    const activeVideo = videoItems.find((item) => item?.status && item.status !== "done") || videoItems[0];
    const videoStatus = activeVideo?.status || "waiting";
    const videoReady = completedVideos === expectedSegments.length;
    container.innerHTML = `
      <div class="stage-visual-heading">
        <span>视频任务</span>
        <strong>${escapeHtml(completedVideos)}/${escapeHtml(expectedSegments.length)}</strong>
      </div>
      <div class="video-mini-meter" data-ready="${videoReady ? "true" : "false"}">
        <i></i><i></i><i></i><i></i><i></i>
      </div>
      <div class="asset-readiness-chart video-status-chart">
        <div data-ready="${generated >= 1}">
          <span>故事版</span>
          <strong>${escapeHtml(generated)}/${escapeHtml(singleVideo ? 1 : 2)}</strong>
        </div>
        <div data-ready="true">
          <span>视频数量</span>
          <strong>${escapeHtml(expectedSegments.length)} 个</strong>
        </div>
        <div data-ready="${videoReady ? "true" : "false"}">
          <span>视频</span>
          <strong>${escapeHtml(videoReady ? "可下载" : failedVideos ? "可重试" : panelVideoStatusLabel(videoStatus))}</strong>
        </div>
      </div>
      <div class="stage-visual-stats">
        <div><strong>${escapeHtml(project.marketBrief?.outputAspectRatio || "9:16")}</strong><span>比例</span></div>
        <div><strong>${escapeHtml(completedVideos)}</strong><span>已完成</span></div>
        <div><strong>${escapeHtml(expectedSegments.length - completedVideos)}</strong><span>待生成</span></div>
      </div>
    `;
    return;
  }

  if (activeStatus === "visual" || activeStatus === "export") {
    container.innerHTML = `
      <div class="stage-visual-heading">
        <span>故事版进度</span>
        <strong>${escapeHtml(generated)}/${escapeHtml(singleVideo ? 1 : 2)}</strong>
      </div>
      <div class="storyboard-mini-grid">
        ${(singleVideo ? [0] : [0, 1]).map((index) => `
          <div data-complete="${index < generated}">
            <span>${singleVideo ? "完整视频" : (index === 0 ? "0-10s" : "10-20s")}</span>
            <i></i>
          </div>
        `).join("")}
      </div>
      <div class="stage-visual-stats">
        <div><strong>${escapeHtml(generated)}</strong><span>已完成</span></div>
        <div><strong>${escapeHtml((singleVideo ? 1 : 2) - generated)}</strong><span>待生成</span></div>
      </div>
    `;
    return;
  }

  const canIdentify = assets.length >= 1;
  const materialPercent = Math.min(100, Math.round((Math.min(assets.length, 4) / 4) * 100));
  container.innerHTML = `
    <div class="stage-visual-heading">
      <span>素材状态</span>
      <strong>${escapeHtml(canIdentify ? "可以识别" : "等待上传")}</strong>
    </div>
    <div class="panel-readiness-ring" style="--panel-percent:${materialPercent}%">
      <strong>${escapeHtml(materialPercent)}%</strong>
      <span>${escapeHtml(canIdentify ? "可识别" : "待上传")}</span>
    </div>
    <div class="asset-readiness-chart">
      <div data-ready="${assets.length >= 1}">
        <span>已上传</span>
        <strong>${escapeHtml(assets.length)} 张</strong>
      </div>
      <div data-ready="${canIdentify}">
        <span>当前状态</span>
        <strong>${escapeHtml(canIdentify ? "可以识别" : "继续上传")}</strong>
      </div>
      <div data-ready="true">
        <span>补图建议</span>
        <strong>${escapeHtml(assets.length ? "侧面 / 后跟 / 鞋底更稳" : "1 张即可开始")}</strong>
      </div>
    </div>
    <div class="stage-visual-stats">
      <div><strong>${escapeHtml(assets.length)}</strong><span>已上传</span></div>
      <div><strong>${escapeHtml(canIdentify ? "可以识别" : "待上传")}</strong><span>识别状态</span></div>
    </div>
  `;
}

export function renderStepper(activeStatus = viewStatus()) {
  const activeIndex = Math.max(0, STAGE_ORDER.indexOf(activeStatus));
  document.querySelectorAll("#stepper li").forEach((item, index) => {
    const reached = isStageReached(item.dataset.step);
    const stepIndex = Math.max(0, STAGE_ORDER.indexOf(item.dataset.step));
    const current = Math.max(0, STAGE_ORDER.indexOf(state.project.status));
    item.classList.toggle("active", stepIndex === activeIndex);
    item.classList.toggle("complete", stepIndex < current);
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
  el("assetGrid").innerHTML = assets.map((asset) => {
    const deleting = state.deletingAssetIds.has(asset.id);
    return `
      <article class="asset-card">
        <div class="asset-card-actions">
        <button class="asset-icon-button danger" type="button"
          data-delete-asset-id="${escapeHtml(asset.id)}" aria-label="删除 ${escapeHtml(asset.name)}"
          aria-busy="${deleting}" ${canUpload && !deleting ? "" : "disabled"}>${deleting ? "…" : "×"}</button>
        </div>
        <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.name)}">
        <span>${escapeHtml(asset.name)}</span>
      </article>
    `;
  }).join("");
  el("assetHint").textContent = project?.status !== "assets"
    ? "当前项目已进入后续步骤，素材已锁定；如需上传新鞋图，请新建项目。"
    : assets.length >= 1
      ? `已上传 ${assets.length} 张图片，识别已可开始。建议补充更多角度提升稳定性。`
      : "至少上传 1 张四视图拼图即可开始识别。建议补充更多角度提升稳定性。";
  el("dropZone").disabled = !canUpload;
  el("fileInput").disabled = !canUpload;
  el("analyzeButton").disabled = state.busy || assets.length < 1;
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
  const singleVideo = isSingleVideoProject(state.project);
  const itemsByStatus = {
    assets: ["图片属于同一款鞋", "关键角度足够清晰", "产品外观可以稳定锁定"],
    analyzing: ["等待识别完成", "保留原始素材", "准备进入人工审核"],
    review: ["目标人群和尺寸已选择", "创意方向和核心信息已整理", "产品锁定已确认"],
    market: ["目标国家已选择", "目标人群已确认", "创意主题、核心信息和语气已填写"],
    script: singleVideo
      ? ["完整视频脚本已生成", "全部镜头按所选时长可审核", "确认后生成一张故事版"]
      : ["完整 20 秒脚本已生成", "全部镜头按时间顺序可审核", "确认后按两个 10 秒分段生成故事版"],
    visual: singleVideo
      ? ["脚本已确认", "故事版方向清晰", "准备生成一张完整故事版"]
      : ["脚本已确认", "故事版方向清晰", "准备生成两张分段故事版"],
    export: singleVideo
      ? ["故事版和脚本已整理", "可生成单个广告视频", "第一版视频已就绪"]
      : ["两张故事版已整理", "两段 10 秒脚本可复制", "第一版视频已就绪"]
  };
  const items = itemsByStatus[status] || itemsByStatus.assets;
  if (status === "visual") {
    const ratio = state.project?.marketBrief?.outputAspectRatio || "9:16";
    const entries = (state.project?.imagePackage?.image_generation || []).filter((item) =>
      item.type === "storyboard_board" && item.aspect_ratio === ratio && (
        singleVideo ? item.segment_id === "full" : ["0-10s", "10-20s"].includes(item.segment_id)
      )
    );
    const complete = entries.filter((item) => item.status === "done" && item.generated_image?.url).length;
    const total = singleVideo ? 1 : 2;
    items[1] = `故事版完成 ${complete}/${total}`;
    items[2] = complete === total ? "可进入生成视频" : "成功内容保留，缺失项可继续生成";
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
  const singleVideo = isSingleVideoProject(state.project);
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
    }
  ];
  if (singleVideo) {
    groups.push({
      name: "videoDurationSeconds",
      icon: "秒",
      label: "视频时长",
      value: `${setup.videoDurationSeconds} 秒`,
      options: compactOptionsHtml("videoDurationSeconds", videoDurationOptions, setup.videoDurationSeconds)
    });
  } else {
    groups.push({
      name: "fixedDuration",
      icon: "20",
      label: "总时长",
      value: "20 秒（2 × 10 秒）",
      fixed: true
    });
    groups.push({
      name: "shotsPerSegment",
      icon: "镜",
      label: "镜头",
      value: `${setup.shotsPerSegment} 个`,
      options: compactOptionsHtml("shotsPerSegment", [[3, "3 个", "每 10 秒"], [4, "4 个", "每 10 秒"], [5, "5 个", "每 10 秒"]], setup.shotsPerSegment)
    });
  }
  container.innerHTML = groups.map((group) => group.fixed ? `
    <div class="review-menu fixed-review-menu" data-review-menu-root="${escapeHtml(group.name)}">
      <div class="review-chip fixed-review-chip" aria-label="${escapeHtml(group.label)}">
        <i aria-hidden="true">${escapeHtml(group.icon)}</i>
        <span>
          <small>${escapeHtml(group.label)}</small>
          <strong>${escapeHtml(group.value)}</strong>
          <em class="setting-origin recommended">固定模式</em>
        </span>
      </div>
    </div>
  ` : `
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
  form.elements.videoDurationSeconds.value = setup.videoDurationSeconds;
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
  const hasMinimumAssets = (state.project?.assets || []).length >= 1;
  document.querySelectorAll("#reviewForm button[type='submit'], button[form='reviewForm']").forEach((button) => {
    button.disabled = !hasAnalysis || !hasMinimumAssets || state.busy;
  });
  const gateHint = el("reviewGateHint");
  if (gateHint) {
    gateHint.textContent = hasMinimumAssets
      ? `已上传 ${state.project?.assets?.length || 0} 张图片，确认后进入脚本；建议继续补充更多角度。`
      : "至少上传 1 张图片并完成产品识别后才能进入脚本。";
    gateHint.classList.toggle("ready", hasMinimumAssets);
  }

  el("qualityNote").textContent = publicQualityNotes(analysis).join("；");
}

export function analysisFromForm() {
  const form = el("reviewForm");
  const previous = state.project.visionAnalysis || {};
  const previousSummary = previous.product_summary || {};
  const previousLock = previous.product_lock_manifest || {};
  const targetCountry = form.elements.targetCountry?.value || "Thailand";
  const audience = form.elements.audience?.value || "日常运动与通勤人群";
  const outputAspectRatio = form.elements.output_aspect_ratio?.value || "9:16";
  const creativeTheme = form.elements.creativeTheme?.value || "city-motion";
  const tone = form.elements.tone?.value || "energetic";
  const rawCoreMessage = form.elements.coreMessage?.value.trim() || "";
  const shotsPerSegment = Number(form.elements.shotsPerSegment?.value || 5);
  const videoDuration = Number(form.elements.videoDurationSeconds?.value || 10);
  const toeAndLace = lines(form.elements.toe_and_lace.value);
  const sole = lines(form.elements.sole_structure.value);
  const sideAndHeel = lines(form.elements.side_and_heel.value);
  const shoeType = form.elements.shoe_type.value.trim() || previousSummary.shoe_type || "当前鞋款";
  const mainColors = lines(form.elements.main_colors.value).length
    ? lines(form.elements.main_colors.value)
    : (Array.isArray(previousLock.main_colors) ? previousLock.main_colors : []);
  const supportingColors = lines(form.elements.supporting_colors.value).length
    ? lines(form.elements.supporting_colors.value)
    : (Array.isArray(previousLock.supporting_colors) ? previousLock.supporting_colors : []);
  const upperMaterial = form.elements.upper_material_visible.value.trim() || previousLock.upper_material_visible || "";
  let mustKeep = lines(form.elements.must_keep.value);
  let mustNotChange = lines(form.elements.must_not_change.value);
  if (!mustKeep.length && Array.isArray(previousLock.must_keep)) mustKeep = previousLock.must_keep.filter(Boolean);
  if (!mustNotChange.length && Array.isArray(previousLock.must_not_change)) mustNotChange = previousLock.must_not_change.filter(Boolean);
  if (!mustKeep.length) {
    mustKeep = [
      `保持${shoeType}的整体轮廓和鞋型比例`,
      mainColors.length ? `保持主色：${mainColors.slice(0, 3).join("、")}` : "",
      upperMaterial ? `保持可见材质和纹理：${upperMaterial}` : "",
      toeAndLace[0] ? `保持鞋头结构：${toeAndLace[0]}` : "",
      sole[0] ? `保持鞋底结构：${sole[0]}` : "",
      sideAndHeel[0] ? `保持侧面图案或标识：${sideAndHeel[0]}` : ""
    ].filter(Boolean);
  }
  if (!mustNotChange.length) {
    mustNotChange = [
      "不要改变鞋款颜色、轮廓、材质纹理、鞋底结构和品牌/图案细节"
    ];
  }
  const preferences = {
    targetCountry,
    audience,
    outputAspectRatio,
    creativeTheme,
    tone,
    shotsPerSegment: [3, 4, 5].includes(shotsPerSegment) ? shotsPerSegment : 5,
    videoDurationSeconds: Number.isInteger(videoDuration) && videoDuration >= 5 && videoDuration <= 15 ? videoDuration : 10
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
      shoe_type: shoeType,
      likely_usage: {
        value: form.elements.likely_usage.value.trim() || previousSummary.likely_usage?.value || "日常穿着",
        evidence: valueAt(previous, "product_summary.likely_usage.evidence", "unknown")
      },
      overall_style: form.elements.overall_style.value.trim() || previousSummary.overall_style || "清爽运动风格"
    },
    product_lock_manifest: {
      main_colors: mainColors,
      supporting_colors: supportingColors,
      upper_material_visible: upperMaterial,
      toe_shape: toeAndLace[0] || "",
      lace_system: toeAndLace.slice(1).join("；"),
      midsole_shape: sole[0] || "",
      outsole_color: sole[1] || "",
      outsole_pattern: sole.slice(2).join("；"),
      side_pattern_or_logo: sideAndHeel[0] || "",
      heel_structure: sideAndHeel.slice(1).join("；"),
      must_keep: mustKeep,
      must_not_change: mustNotChange
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
  const videoDuration = Number(form.elements.videoDurationSeconds?.value || setup.videoDurationSeconds);
  const preferences = {
    targetCountry,
    audience,
    outputAspectRatio: form.elements.output_aspect_ratio?.value || setup.outputAspectRatio,
    creativeTheme,
    tone,
    shotsPerSegment: [3, 4, 5].includes(shotsPerSegment) ? shotsPerSegment : 5,
    videoDurationSeconds: Number.isInteger(videoDuration) && videoDuration >= 5 && videoDuration <= 15 ? videoDuration : 10
  };
  if (rawCoreMessage) preferences.coreMessage = rawCoreMessage;
  saveProjectPreferences(state.project, preferences);
  return {
    targetCountry,
    audience,
    creativeTheme,
    coreMessage,
    tone,
    outputAspectRatio: form.elements.output_aspect_ratio?.value || setup.outputAspectRatio,
    videoDurationSeconds: preferences.videoDurationSeconds
  };
}

import {
  api,
  countryNames,
  creativeThemeOptions,
  el,
  escapeHtml,
  isSingleVideoProject,
  projectSetup,
  setBusy,
  showToast,
  state,
  toneOptions
} from "./core.js";
import {
  hasReadyStoryboards,
  planningPackageFromForm,
  setWorkflowBusy,
  validatePlanningPackage
} from "./demo-loop.js";
import {
  marketBriefFromForm,
  setMarketSaving,
  validateMarketBrief
} from "./market.js";
import {
  analysisFromForm,
  marketBriefFromReviewForm,
  renderProjectList,
  renderWorkspace
} from "./render.js";

export async function loadProjects() {
  const data = await api("/api/projects");
  state.projects = data.projects || [];
  renderProjectList();
}

export async function openProject(projectId) {
  const data = await api(`/api/projects/${encodeURIComponent(projectId)}`);
  state.project = data.project;
  state.viewStatus = data.project.status === "export" && !hasReadyStoryboards(data.project)
    ? "visual"
    : data.project.status;
  state.visualGenerationError = "";
  el("emptyScreen").classList.add("hidden");
  el("workspace").classList.remove("hidden");
  renderWorkspace();
  renderProjectList();
}

export async function switchWorkflowMode(workflowMode, confirmReset = false) {
  if (!state.project?.id) return;
  const data = await api(
    `/api/projects/${encodeURIComponent(state.project.id)}/workflow-mode`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowMode, confirmReset })
    }
  );
  state.project = data.project;
  if (data.reset) {
    state.viewStatus = "script";
  }
  await loadProjects();
  renderWorkspace();
  renderProjectList();
  return data;
}

export async function deleteProject(projectId) {
  if (state.deletingProjectIds.has(projectId)) return;

  state.deletingProjectIds.add(projectId);
  renderProjectList();
  try {
    await api(`/api/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
    const wasCurrentProject = state.project?.id === projectId;
    state.selectedProjectIds.delete(projectId);
    await loadProjects();
    if (wasCurrentProject) {
      if (state.projects.length) {
        await openProject(state.projects[0].id);
      } else {
        state.project = null;
        state.viewStatus = null;
        el("workspace").classList.add("hidden");
        el("emptyScreen").classList.remove("hidden");
        renderProjectList();
      }
    }
    showToast("项目已删除。");
  } catch (error) {
    showToast(error.message);
  } finally {
    state.deletingProjectIds.delete(projectId);
    renderProjectList();
  }
}

export function startProjectBatchDelete() {
  state.projectSelectionMode = true;
  state.selectedProjectIds.clear();
  renderProjectList();
}

export function cancelProjectBatchDelete() {
  state.projectSelectionMode = false;
  state.selectedProjectIds.clear();
  renderProjectList();
}

export function toggleProjectSelection(projectId, selected) {
  if (projectId === "__all__") {
    const shouldClear = state.selectedProjectIds.size === state.projects.length;
    state.selectedProjectIds.clear();
    if (!shouldClear) {
      state.projects.forEach((project) => state.selectedProjectIds.add(project.id));
    }
    renderProjectList();
    return;
  }
  if (selected) state.selectedProjectIds.add(projectId);
  else state.selectedProjectIds.delete(projectId);
  renderProjectList();
}

export async function deleteSelectedProjects() {
  const ids = [...state.selectedProjectIds].filter((id) =>
    state.projects.some((project) => project.id === id)
  );
  if (!ids.length) return;
  if (!window.confirm(`删除所选 ${ids.length} 个项目？`)) return;

  ids.forEach((id) => state.deletingProjectIds.add(id));
  renderProjectList();
  try {
    await api("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectIds: ids })
    });
    ids.forEach((id) => state.selectedProjectIds.delete(id));
    const currentWasDeleted = ids.includes(state.project?.id);
    await loadProjects();
    if (currentWasDeleted) {
      if (state.projects.length) await openProject(state.projects[0].id);
      else {
        state.project = null;
        state.viewStatus = null;
        el("workspace").classList.add("hidden");
        el("emptyScreen").classList.remove("hidden");
      }
    }
    state.projectSelectionMode = false;
    showToast(`已删除 ${ids.length} 个项目。`);
  } catch (error) {
    showToast(error.message);
  } finally {
    ids.forEach((id) => state.deletingProjectIds.delete(id));
    renderProjectList();
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function deleteAsset(assetId) {
  if (!state.project?.id) return;
  if (state.deletingAssetIds.has(assetId)) return;
  if (state.project.status !== "assets") {
    showToast("项目进入后续步骤后，素材已锁定。");
    return;
  }

  state.deletingAssetIds.add(assetId);
  renderWorkspace();
  try {
    const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/assets/${encodeURIComponent(assetId)}`, {
      method: "DELETE"
    });
    state.project = data.project;
    await loadProjects();
    showToast("素材已删除。");
  } catch (error) {
    showToast(`删除素材失败：${error.message}`);
  } finally {
    state.deletingAssetIds.delete(assetId);
    renderWorkspace();
  }
}

export async function uploadFiles(fileList) {
  if (!state.project) {
    showToast("请先创建一个项目。");
    return;
  }
  if (state.project.status !== "assets") {
    showToast("当前项目已进入后续步骤，不能继续上传素材；请新建项目重新上传。");
    return;
  }
  const files = Array.from(fileList || []).filter(
    (file) => /^image\/(jpeg|png|webp)$/.test(file.type)
  );
  if (!files.length) {
    showToast("请选择 JPG、PNG 或 WebP 图片。");
    return;
  }

  setBusy(true, "正在保存图片...");
  try {
    const payload = {
      files: await Promise.all(files.map(async (file) => ({
        name: file.name,
        dataUrl: await fileToDataUrl(file)
      })))
    };
    const data = await api(`/api/projects/${state.project.id}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    state.project = data.project;
    state.viewStatus = data.project.status;
    renderWorkspace();
    await loadProjects();
    showToast(`已保存 ${files.length} 张图片。`);
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

export async function analyze() {
  if ((state.project?.assets || []).length < 1) {
    showToast("请先上传至少 1 张同款商品参考图。");
    return;
  }
  state.viewStatus = "review";
  renderWorkspace();
  setBusy(true, "正在识别鞋款...");
  try {
    const data = await api(`/api/projects/${state.project.id}/analyze`, { method: "POST" });
    state.project = data.project;
    state.viewStatus = data.project.status;
    renderWorkspace();
    await loadProjects();
    showToast(data.project.visionAnalysis?.mode === "api"
      ? "识别完成，请检查产品锁定。"
      : "当前使用演示识别，请根据图片修改。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
    renderWorkspace();
  }
}

function renderBriefSummary(project) {
  const brief = project.marketBrief || {};
  const dialog = el("briefSummaryDialog");
  const content = el("briefSummaryContent");
  if (!dialog || !content) return;
  const labelFor = (options, value) => options.find(([item]) => item === value)?.[1] || value || "";
  content.innerHTML = `
    <div class="summary-grid">
      <div><span>目标国家</span><strong>${escapeHtml(countryNames[brief.targetCountry] || brief.targetCountry || project.targetCountry)}</strong></div>
      <div><span>目标人群</span><strong>${escapeHtml(brief.audience || project.audience)}</strong></div>
      <div><span>创意主题</span><strong>${escapeHtml(labelFor(creativeThemeOptions, brief.creativeTheme))}</strong></div>
      <div><span>语气</span><strong>${escapeHtml(labelFor(toneOptions, brief.tone))}</strong></div>
    </div>
    <p class="summary-message">${escapeHtml(brief.coreMessage || "")}</p>
  `;
  dialog.showModal();
}

export async function createProject(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  try {
    const data = await api("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form))
    });
    el("newProjectDialog").close();
    formElement.reset();
    await loadProjects();
    await openProject(data.project.id);
  } catch (error) {
    showToast(error.message);
  }
}

export async function confirmReview(event) {
  event.preventDefault();
  if ((state.project?.assets || []).length < 1) {
    const message = "请先上传至少 1 张图片并完成产品识别，再进入脚本。";
    el("reviewGateHint").textContent = message;
    showToast(message);
    return;
  }
  const marketBrief = marketBriefFromReviewForm();
  setBusy(true, "正在确认产品与创意...");
  try {
    const reviewed = await api(`/api/projects/${state.project.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visionAnalysis: analysisFromForm() })
    });
    const marketed = await api(`/api/projects/${encodeURIComponent(reviewed.project.id)}/market`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketBrief })
    });
    state.project = marketed.project;
    state.viewStatus = "script";
    renderWorkspace();
    await loadProjects();
    renderBriefSummary(state.project);
    showToast("产品锁定和创意方向已确认。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

export async function saveMarketBrief(event) {
  event.preventDefault();
  const marketBrief = marketBriefFromForm();
  const validationMessage = validateMarketBrief(marketBrief);
  if (validationMessage) {
    el("marketHint").textContent = validationMessage;
    showToast(validationMessage);
    return;
  }

  setMarketSaving(true);
  try {
    const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/market`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketBrief })
    });
    state.project = data.project;
    state.viewStatus = data.project.status;
    renderWorkspace();
    await loadProjects();
    showToast("市场创意已保存。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setMarketSaving(false);
  }
}

export async function generateScript() {
  el("briefSummaryDialog")?.close();
  const setup = projectSetup(state.project);
  const progressStartedAt = Date.now();
  setWorkflowBusy(true, "generateScriptButton", "正在生成脚本...", "生成演示脚本");
  setScriptProgress(true);
  try {
    const body = isSingleVideoProject(state.project)
      ? { videoDurationSeconds: setup.videoDurationSeconds }
      : { shotsPerSegment: setup.shotsPerSegment };
    const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/script/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    await waitForMinimumFeedback(progressStartedAt);
    state.project = data.project;
    state.viewStatus = data.project.status;
    renderWorkspace();
    await loadProjects();
    showToast(isSingleVideoProject(state.project) ? "单视频脚本已生成。" : "演示脚本已生成。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setWorkflowBusy(false, "generateScriptButton", "正在生成脚本...", "生成演示脚本");
    setScriptProgress(false);
  }
}

async function waitForMinimumFeedback(startedAt, minimumMs = 1800) {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
}

function updateProductionProgressDom(progress) {
  if (!progress?.active) return;
  if (el("panelProgressBar")) el("panelProgressBar").style.width = `${progress.percent}%`;
  if (el("panelProgressText")) el("panelProgressText").textContent = progress.message;
}

function setScriptProgress(active) {
  const progress = el("scriptProgress");
  if (!progress) return;
  progress.hidden = !active;
  progress.classList.toggle("active", active);
  const label = progress.querySelector("strong");
  if (!label) return;
  window.clearInterval(setScriptProgress.timer);
  if (!active) {
    state.workflowProgress = null;
    label.textContent = "0%";
    return;
  }
  const singleVideo = isSingleVideoProject(state.project);
  let percent = 12;
  const message = progress.querySelector(".workflow-progress-message");
  const fill = progress.querySelector(".workflow-progress-fill");
  state.workflowProgress = { active: true, stage: "script", percent, message: "正在整理市场语言与产品锁定..." };
  updateProductionProgressDom(state.workflowProgress);
  label.textContent = `${percent}%`;
  if (fill) fill.style.width = `${percent}%`;
  setScriptProgress.timer = window.setInterval(() => {
    percent = Math.min(92, percent + Math.ceil((100 - percent) / 9));
    const status = percent < 42
      ? "正在整理市场语言与产品锁定..."
      : percent < 72
        ? singleVideo
          ? "正在生成单条视频镜头时间线..."
          : "正在生成两个 10 秒镜头序列..."
        : singleVideo
          ? "正在校验所选时长内的完整时间线..."
          : "正在校验 20 秒时间线与字段完整性...";
    state.workflowProgress = { active: true, stage: "script", percent, message: status };
    updateProductionProgressDom(state.workflowProgress);
    label.textContent = `${percent}%`;
    if (fill) fill.style.width = `${percent}%`;
    if (message) message.textContent = status;
  }, 420);
}

function visualCompletedCount(project = state.project) {
  const ratio = project?.marketBrief?.outputAspectRatio || "9:16";
  const singleVideo = isSingleVideoProject(project);
  return (project?.imagePackage?.image_generation || []).filter((item) =>
    item.type === "storyboard_board" && item.aspect_ratio === ratio &&
    (singleVideo ? item.segment_id === "full" : ["0-10s", "10-20s"].includes(item.segment_id)) &&
    item.status === "done" && item.generated_image?.url
  ).length;
}

function updateVisualProgressDom() {
  const progress = state.workflowProgress;
  if (!progress?.active || progress.stage !== "visual") return;
  const total = isSingleVideoProject(state.project) ? 1 : 2;
  const root = el("visualProgress");
  const fill = root?.querySelector(".workflow-progress-fill");
  const label = root?.querySelector("strong");
  const message = root?.querySelector(".workflow-progress-message");
  if (fill) fill.style.width = `${progress.percent}%`;
  if (label) label.textContent = `${progress.percent}%`;
  if (message) message.textContent = progress.message;
  if (el("visualProgressCount")) el("visualProgressCount").textContent = `${progress.completed}/${total}`;
  if (el("panelProgressBar")) el("panelProgressBar").style.width = `${progress.percent}%`;
  if (el("panelProgressText")) el("panelProgressText").textContent = progress.message;
  updateProductionProgressDom(progress);
}

function startVisualProgress() {
  window.clearInterval(startVisualProgress.timer);
  let percent = 8;
  let ticks = 0;
  const singleVideo = isSingleVideoProject(state.project);
  const total = singleVideo ? 1 : 2;
  state.workflowProgress = {
    active: true,
    stage: "visual",
    percent,
    completed: visualCompletedCount(),
    message: singleVideo
      ? "0/1 · 正在提交一张 img2img 故事板任务..."
      : "0/2 · 正在提交两张 img2img 故事板任务..."
  };
  startVisualProgress.timer = window.setInterval(async () => {
    ticks += 1;
    const completed = visualCompletedCount();
    percent = Math.min(94, Math.max(percent + Math.ceil((96 - percent) / 18), completed === 1 ? 58 : 0));
    const message = singleVideo
      ? (completed === 1
        ? "1/1 · 已保留完成图片，继续等待生成结果..."
        : percent < 35
          ? "0/1 · 正在提交一张 img2img 故事板任务..."
          : percent < 70
            ? "0/1 · 图片供应商正在生成，请保持页面开启..."
            : "0/1 · 正在等待供应商返回并保存本地图片...")
      : completed === 1
        ? "1/2 · 已保留完成图片，继续等待另一张..."
      : percent < 35
        ? "0/2 · 正在提交两张 img2img 故事板任务..."
        : percent < 70
          ? "0/2 · 图片供应商正在并发生成，请保持页面开启..."
          : "0/2 · 正在等待供应商返回并保存本地图片...";
    state.workflowProgress = { active: true, stage: "visual", percent, completed, message };
    updateVisualProgressDom();
    if (ticks % 3 === 0 && !startVisualProgress.polling && state.project?.id) {
      startVisualProgress.polling = true;
      try {
        const latest = await api(`/api/projects/${encodeURIComponent(state.project.id)}`);
        if (state.workflowProgress?.active) {
          const previousCount = visualCompletedCount();
          state.project = latest.project;
          if (visualCompletedCount() !== previousCount) {
            state.viewStatus = "visual";
            renderWorkspace();
          }
        }
      } catch {
        // The primary generation request remains authoritative.
      } finally {
        startVisualProgress.polling = false;
      }
    }
  }, 650);
}

function stopVisualProgress() {
  window.clearInterval(startVisualProgress.timer);
  startVisualProgress.polling = false;
  state.workflowProgress = null;
}

async function restoreVisualProject() {
  try {
    const latest = await api(`/api/projects/${encodeURIComponent(state.project.id)}`);
    state.project = latest.project;
  } catch {
    // Keep the last usable project snapshot when refresh also fails.
  }
}

export async function confirmScript(event) {
  event.preventDefault();
  const planningPackage = planningPackageFromForm();
  const validationMessage = validatePlanningPackage(planningPackage);
  if (validationMessage) {
    el("scriptHint").textContent = validationMessage;
    showToast(validationMessage);
    return;
  }

  setWorkflowBusy(true, "confirmScriptButton", "正在确认脚本...", "确认脚本");
  try {
    const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/script/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planningPackage })
    });
    state.project = data.project;
    state.viewStatus = data.project.status;
    renderWorkspace();
    await loadProjects();
    showToast("广告脚本已确认。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setWorkflowBusy(false, "confirmScriptButton", "正在确认脚本...", "确认脚本");
  }
}

export async function confirmScriptAndGenerateVisual() {
  const planningPackage = planningPackageFromForm();
  const validationMessage = validatePlanningPackage(planningPackage);
  if (validationMessage) {
    el("scriptHint").textContent = validationMessage;
    showToast(validationMessage);
    return;
  }

  setWorkflowBusy(
    true,
    "confirmAndGenerateButton",
    "正在生成故事板图片...",
    "确认脚本并生成故事板图片"
  );
  let scriptConfirmed = false;
  let visualStartedAt = 0;
  try {
    state.visualGenerationError = "";
    const confirmed = await api(`/api/projects/${encodeURIComponent(state.project.id)}/script/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planningPackage })
    });
    state.project = confirmed.project;
    state.viewStatus = "visual";
    scriptConfirmed = true;
    visualStartedAt = Date.now();
    startVisualProgress();
    renderWorkspace();
    await loadProjects();

    const visual = await api(`/api/projects/${encodeURIComponent(state.project.id)}/visual/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    await waitForMinimumFeedback(visualStartedAt);
    state.project = visual.project;
    stopVisualProgress();
    state.viewStatus = "visual";
    state.visualGenerationError = hasReadyStoryboards(state.project)
      ? ""
      : "当前没有可交付的真实故事板图片。请确认图片供应商已就绪后继续生成。";
    renderWorkspace();
    await loadProjects();
    showToast(hasReadyStoryboards(state.project) ? "故事板图片已生成。" : state.visualGenerationError);
  } catch (error) {
    if (scriptConfirmed) {
      stopVisualProgress();
      await restoreVisualProject();
      state.viewStatus = "visual";
      state.visualGenerationError = error.message;
      renderWorkspace();
      showToast(`脚本已确认，图片生成失败：${error.message}`);
    } else {
      showToast(error.message);
    }
  } finally {
    setWorkflowBusy(
      false,
      "confirmAndGenerateButton",
      "正在生成故事板图片...",
      "确认脚本并生成故事板图片"
    );
    renderWorkspace();
  }
}

export async function generateVisual() {
  const progressStartedAt = Date.now();
  setWorkflowBusy(true, "generateVisualButton", "正在生成故事板图片...", "生成故事板图片");
  try {
    state.visualGenerationError = "";
    state.viewStatus = "visual";
    startVisualProgress();
    renderWorkspace();
    const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/visual/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    await waitForMinimumFeedback(progressStartedAt);
    state.project = data.project;
    stopVisualProgress();
    state.viewStatus = "visual";
    state.visualGenerationError = hasReadyStoryboards(state.project)
      ? ""
      : "当前没有可交付的真实故事板图片。请确认图片供应商已就绪后继续生成。";
    renderWorkspace();
    await loadProjects();
    showToast(hasReadyStoryboards(state.project) ? "故事板图片已生成。" : state.visualGenerationError);
  } catch (error) {
    stopVisualProgress();
    await restoreVisualProject();
    state.visualGenerationError = error.message;
    state.viewStatus = "visual";
    renderWorkspace();
    showToast(error.message);
  } finally {
    setWorkflowBusy(false, "generateVisualButton", "正在生成故事板图片...", "生成故事板图片");
    renderWorkspace();
  }
}

function currentVideoSegmentId(project = state.project) {
  if (!project) return "full";
  if (isSingleVideoProject(project)) return "full";
  return project.videoPackage?.video_generation?.find((item) => item.status === "failed")?.segment_id
    || project.videoPackage?.video_generation?.find((item) => item.status !== "done")?.segment_id
    || project.videoPackage?.video_generation?.[0]?.segment_id
    || "full";
}

export async function generateVideo() {
  if (!state.project) return;
  setBusy(true, "正在生成视频...");
  try {
    const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/videos/generate`, {
      method: "POST"
    });
    state.project = data.project;
    state.viewStatus = "export";
    renderWorkspace();
    await loadProjects();
    showToast("视频任务已提交。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
    renderWorkspace();
  }
}

export async function refreshVideoStatus() {
  if (!state.project) return;
  setBusy(true, "正在刷新视频状态...");
  try {
    const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/videos/status`);
    state.project = data.project;
    state.viewStatus = "export";
    renderWorkspace();
    await loadProjects();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
    renderWorkspace();
  }
}

export async function retryVideo() {
  if (!state.project) return;
  const segmentId = currentVideoSegmentId(state.project);
  setBusy(true, "正在重试视频...");
  try {
    const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/videos/${encodeURIComponent(segmentId)}/retry`, {
      method: "POST"
    });
    state.project = data.project;
    state.viewStatus = "export";
    renderWorkspace();
    await loadProjects();
    showToast("已重新提交视频任务。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
    renderWorkspace();
  }
}

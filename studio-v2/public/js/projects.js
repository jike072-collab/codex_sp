import { api, el, setBusy, showToast, state } from "./core.js";
import {
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
  state.viewStatus = data.project.status;
  state.visualGenerationError = "";
  el("emptyScreen").classList.add("hidden");
  el("workspace").classList.remove("hidden");
  renderWorkspace();
  renderProjectList();
}

export async function deleteProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  const label = project?.name || "这个项目";
  if (!window.confirm(`删除“${label}”？`)) return;

  try {
    await api(`/api/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
    const wasCurrentProject = state.project?.id === projectId;
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
  if (state.project.status !== "assets") {
    showToast("项目进入后续步骤后，素材已锁定。");
    return;
  }
  const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/assets/${encodeURIComponent(assetId)}`, {
    method: "DELETE"
  });
  state.project = data.project;
  renderWorkspace();
  await loadProjects();
  showToast("素材已删除。");
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
  content.innerHTML = `
    <div class="summary-grid">
      <div><span>目标国家</span><strong>${brief.targetCountry || project.targetCountry}</strong></div>
      <div><span>目标人群</span><strong>${brief.audience || project.audience}</strong></div>
      <div><span>创意主题</span><strong>${brief.creativeTheme || ""}</strong></div>
      <div><span>语气</span><strong>${brief.tone || ""}</strong></div>
    </div>
    <p class="summary-message">${brief.coreMessage || ""}</p>
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
  const shotsPerSegment = Number(
    document.querySelector("input[name='shotsPerSegment']:checked")?.value || 5
  );
  setWorkflowBusy(true, "generateScriptButton", "正在生成脚本...", "生成演示脚本");
  setScriptProgress(true);
  try {
    const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/script/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shotsPerSegment })
    });
    state.project = data.project;
    state.viewStatus = data.project.status;
    renderWorkspace();
    await loadProjects();
    showToast("演示脚本已生成。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setWorkflowBusy(false, "generateScriptButton", "正在生成脚本...", "生成演示脚本");
    setScriptProgress(false);
  }
}

function setScriptProgress(active) {
  const progress = el("scriptProgress");
  if (!progress) return;
  progress.hidden = !active;
  progress.classList.toggle("active", active);
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
    "正在生成故事版图片...",
    "确认脚本并生成故事版图片"
  );
  let scriptConfirmed = false;
  try {
    state.visualGenerationError = "";
    const confirmed = await api(`/api/projects/${encodeURIComponent(state.project.id)}/script/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planningPackage })
    });
    state.project = confirmed.project;
    state.viewStatus = "export";
    scriptConfirmed = true;
    renderWorkspace();
    await loadProjects();

    const visual = await api(`/api/projects/${encodeURIComponent(state.project.id)}/visual/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    state.project = visual.project;
    state.viewStatus = "export";
    state.visualGenerationError = "";
    renderWorkspace();
    await loadProjects();
    showToast("故事版图片已生成。");
  } catch (error) {
    if (scriptConfirmed) {
      state.viewStatus = "export";
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
      "正在生成故事版图片...",
      "确认脚本并生成故事版图片"
    );
  }
}

export async function generateVisual() {
  setWorkflowBusy(true, "generateVisualButton", "正在生成故事版图片...", "生成故事版图片");
  try {
    state.visualGenerationError = "";
    state.viewStatus = "export";
    renderWorkspace();
    const data = await api(`/api/projects/${encodeURIComponent(state.project.id)}/visual/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    state.project = data.project;
    state.viewStatus = "export";
    state.visualGenerationError = "";
    renderWorkspace();
    await loadProjects();
    showToast("故事版图片已生成。");
  } catch (error) {
    state.visualGenerationError = error.message;
    state.viewStatus = "export";
    renderWorkspace();
    showToast(error.message);
  } finally {
    setWorkflowBusy(false, "generateVisualButton", "正在生成故事版图片...", "生成故事版图片");
  }
}

export function downloadExportPackage() {
  window.location.href = `/api/projects/${encodeURIComponent(state.project.id)}/export`;
}

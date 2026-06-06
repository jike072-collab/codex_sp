import { api, el, setBusy, showToast, state } from "./core.js";
import {
  marketBriefFromForm,
  setMarketSaving,
  validateMarketBrief
} from "./market.js";
import {
  analysisFromForm,
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
  el("emptyScreen").classList.add("hidden");
  el("workspace").classList.remove("hidden");
  renderWorkspace();
  renderProjectList();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadFiles(fileList) {
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
  setBusy(true, "正在识别鞋款...");
  try {
    const data = await api(`/api/projects/${state.project.id}/analyze`, { method: "POST" });
    state.project = data.project;
    renderWorkspace();
    await loadProjects();
    showToast(data.project.visionAnalysis?.mode === "api"
      ? "识别完成，请检查产品锁定。"
      : "当前使用演示识别，请根据图片修改。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

export async function createProject(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form))
    });
    el("newProjectDialog").close();
    event.currentTarget.reset();
    await loadProjects();
    await openProject(data.project.id);
  } catch (error) {
    showToast(error.message);
  }
}

export async function confirmReview(event) {
  event.preventDefault();
  setBusy(true, "正在保存审核...");
  try {
    const data = await api(`/api/projects/${state.project.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visionAnalysis: analysisFromForm() })
    });
    state.project = data.project;
    renderWorkspace();
    await loadProjects();
    showToast("产品锁定已确认。");
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
    renderWorkspace();
    await loadProjects();
    showToast("市场创意已保存。");
  } catch (error) {
    showToast(error.message);
  } finally {
    setMarketSaving(false);
  }
}

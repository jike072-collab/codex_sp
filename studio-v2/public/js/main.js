import { el, showToast, state } from "./core.js";
import { copyBlockText } from "./demo-loop.js";
import {
  analyze,
  confirmReview,
  confirmScript,
  createProject,
  deleteProject,
  downloadExportPackage,
  generateScript,
  generateVisual,
  loadProjects,
  openProject,
  saveMarketBrief,
  uploadFiles
} from "./projects.js";
import { canViewStep, renderWorkspace } from "./render.js";
import {
  clearProviderSettingsInputs,
  closeProviderSettings,
  openProviderSettings,
  saveProviderSettings
} from "./settings.js";

function wireEvents() {
  const openDialog = () => el("newProjectDialog").showModal();
  el("newProjectButton").addEventListener("click", openDialog);
  el("emptyCreateButton").addEventListener("click", openDialog);
  el("closeDialogButton").addEventListener("click", () => el("newProjectDialog").close());
  el("apiSettingsButton").addEventListener("click", openProviderSettings);
  el("closeApiSettingsButton").addEventListener("click", closeProviderSettings);
  el("apiSettingsDialog").addEventListener("close", clearProviderSettingsInputs);
  el("apiSettingsForm").addEventListener("submit", saveProviderSettings);
  el("newProjectForm").addEventListener("submit", createProject);
  el("reviewForm").addEventListener("submit", confirmReview);
  el("marketForm").addEventListener("submit", saveMarketBrief);
  el("analyzeButton").addEventListener("click", analyze);

  el("backToAssetsButton").addEventListener("click", () => {
    state.viewStatus = "assets";
    renderWorkspace();
  });
  el("editReviewButton").addEventListener("click", () => {
    state.viewStatus = "review";
    renderWorkspace();
  });
  el("headerExportButton").addEventListener("click", downloadExportPackage);

  el("stepper").addEventListener("click", (event) => {
    const item = event.target.closest("[data-step]");
    if (!item) return;
    const step = item.dataset.step;
    if (!canViewStep(step)) {
      showToast("这一步还没有生成内容。");
      return;
    }
    state.viewStatus = step;
    renderWorkspace();
  });

  el("stepper").addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const item = event.target.closest("[data-step]");
    if (!item) return;
    event.preventDefault();
    item.click();
  });

  el("workspace").addEventListener("submit", (event) => {
    if (event.target.id === "scriptForm") confirmScript(event);
  });

  el("workspace").addEventListener("click", (event) => {
    const copyButton = event.target.closest("[data-copy-target]");
    if (copyButton) {
      copyBlockText(copyButton.dataset.copyTarget)
        .then(() => showToast("已复制。"))
        .catch((error) => showToast(error.message));
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const actions = {
      "edit-market": () => {
        state.viewStatus = "market";
        renderWorkspace();
      },
      "generate-script": () => generateScript(),
      "generate-visual": () => generateVisual(),
      "download-export": () => downloadExportPackage()
    };
    actions[actionButton.dataset.action]?.();
  });

  el("projectList").addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-project-id]");
    if (deleteButton) {
      deleteProject(deleteButton.dataset.deleteProjectId);
      return;
    }

    const button = event.target.closest("[data-project-id]");
    if (button) {
      openProject(button.dataset.projectId).catch((error) => showToast(error.message));
    }
  });

  const dropZone = el("dropZone");
  const fileInput = el("fileInput");
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => uploadFiles(fileInput.files));

  ["dragenter", "dragover"].forEach((name) => {
    dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    });
  });
  dropZone.addEventListener("drop", (event) => uploadFiles(event.dataTransfer.files));
}

async function boot() {
  wireEvents();
  try {
    await loadProjects();
    if (state.projects.length) await openProject(state.projects[0].id);
  } catch (error) {
    showToast(`本地服务连接失败：${error.message}`);
  }
}

boot();

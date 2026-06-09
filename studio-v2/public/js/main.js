import { el, showToast, state } from "./core.js";
import { copyBlockText } from "./demo-loop.js";
import {
  analyze,
  confirmReview,
  confirmScript,
  confirmScriptAndGenerateVisual,
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
import { canViewStep, renderWorkspace, updateAspectSummary } from "./render.js";
import {
  clearProviderSettingsInputs,
  closeProviderSettings,
  openProviderSettings,
  saveProviderSettings,
  toggleProviderSecret
} from "./settings.js";

function wireEvents() {
  const openDialog = () => el("newProjectDialog").showModal();
  el("newProjectButton").addEventListener("click", openDialog);
  el("emptyCreateButton").addEventListener("click", openDialog);
  el("closeDialogButton").addEventListener("click", () => el("newProjectDialog").close());
  el("apiSettingsButton").addEventListener("click", openProviderSettings);
  el("closeApiSettingsButton").addEventListener("click", closeProviderSettings);
  el("apiSettingsDialog").addEventListener("close", clearProviderSettingsInputs);
  el("apiSettingsDialog").addEventListener("click", toggleProviderSecret);
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
  el("openAspectDrawerButton").addEventListener("click", () => el("aspectDrawer").showModal());
  el("closeBriefSummaryButton").addEventListener("click", () => el("briefSummaryDialog").close());
  el("summaryGenerateScriptButton").addEventListener("click", generateScript);

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
    const audienceChoice = event.target.closest("input[name='audience_choice']");
    if (audienceChoice) {
      el("reviewForm").elements.audience.value = audienceChoice.value;
      return;
    }

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
        state.viewStatus = "review";
        renderWorkspace();
      },
      "confirm-and-generate-visual": () => confirmScriptAndGenerateVisual(),
      "generate-script": () => generateScript(),
      "generate-visual": () => generateVisual(),
      "download-export": () => downloadExportPackage()
    };
    actions[actionButton.dataset.action]?.();
  });

  el("aspectDrawer").addEventListener("click", (event) => {
    const input = event.target.closest("input[name='output_aspect_ratio']");
    if (!input) return;
    updateAspectSummary(input.value);
    el("aspectDrawer").close();
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
  dropZone.addEventListener("click", () => {
    if (dropZone.disabled) return;
    fileInput.value = "";
    fileInput.click();
  });
  fileInput.addEventListener("change", async () => {
    await uploadFiles(fileInput.files);
    fileInput.value = "";
  });

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
  dropZone.addEventListener("drop", (event) => {
    if (dropZone.disabled) return;
    uploadFiles(event.dataTransfer.files);
  });
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

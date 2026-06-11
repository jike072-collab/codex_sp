import { el, readProjectPreferences, saveProjectPreferences, showToast, state } from "./core.js";
import { copyBlockText } from "./demo-loop.js";
import {
  analyze,
  confirmReview,
  confirmScript,
  confirmScriptAndGenerateVisual,
  createProject,
  deleteAsset,
  deleteProject,
  deleteSelectedProjects,
  generateScript,
  generateVisual,
  loadProjects,
  openProject,
  saveMarketBrief,
  startProjectBatchDelete,
  cancelProjectBatchDelete,
  toggleProjectSelection,
  uploadFiles
} from "./projects.js";
import {
  canViewStep,
  renderWorkspace,
  syncReviewSummaries
} from "./render.js";
import { refreshProviderSettings } from "./settings.js";

function wireEvents() {
  const openDialog = () => el("newProjectDialog").showModal();
  el("newProjectButton").addEventListener("click", openDialog);
  el("emptyCreateButton").addEventListener("click", openDialog);
  el("closeDialogButton").addEventListener("click", () => el("newProjectDialog").close());
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
  el("closeBriefSummaryButton").addEventListener("click", () => el("briefSummaryDialog").close());
  el("summaryGenerateScriptButton").addEventListener("click", generateScript);
  el("reviewForm").addEventListener("input", syncReviewSummaries);
  el("reviewForm").addEventListener("change", syncReviewSummaries);
  el("closeImagePreviewButton").addEventListener("click", () => el("imagePreviewDialog").close());
  el("imagePreviewDialog").addEventListener("click", (event) => {
    if (event.target.id === "imagePreviewDialog") el("imagePreviewDialog").close();
  });
  el("productionDockAction").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const target = button.dataset.targetId
      ? el(button.dataset.targetId)
      : button.dataset.targetSelector
        ? document.querySelector(button.dataset.targetSelector)
        : null;
    if (target && !target.disabled) target.click();
  });

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

  el("workspace").addEventListener("input", (event) => {
    const textarea = event.target.closest("textarea[data-shot-field]");
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  });

  el("workspace").addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-review-menu]");
    if (menuButton) {
      const name = menuButton.dataset.reviewMenu;
      const panel = document.querySelector(`[data-review-panel="${name}"]`);
      const willOpen = panel?.classList.contains("hidden");
      document.querySelectorAll("[data-review-panel]").forEach((item) => item.classList.add("hidden"));
      document.querySelectorAll("[data-review-menu]").forEach((item) => item.setAttribute("aria-expanded", "false"));
      if (panel && willOpen) {
        panel.classList.remove("hidden");
        menuButton.setAttribute("aria-expanded", "true");
      }
      return;
    }

    const reviewOption = event.target.closest("[data-review-select]");
    if (reviewOption) {
      const form = el("reviewForm");
      const name = reviewOption.dataset.reviewSelect;
      if (form.elements[name]) {
        form.elements[name].value = reviewOption.dataset.value || "";
        const root = reviewOption.closest("[data-review-menu-root]");
        const chip = root?.querySelector(".review-chip strong");
        if (chip) chip.textContent = reviewOption.dataset.label || reviewOption.dataset.value || "";
        root?.querySelectorAll(".review-option").forEach((item) => item.classList.remove("selected"));
        reviewOption.classList.add("selected");
        const preferences = readProjectPreferences(state.project);
        const modifiedSettings = new Set(preferences.modifiedSettings || []);
        modifiedSettings.add(name);
        saveProjectPreferences(state.project, { modifiedSettings: [...modifiedSettings] });
        const origin = root?.querySelector(".setting-origin");
        if (origin) {
          origin.textContent = "用户已修改";
          origin.classList.remove("recommended");
          origin.classList.add("modified");
        }
      }
      document.querySelectorAll("[data-review-panel]").forEach((item) => item.classList.add("hidden"));
      document.querySelectorAll("[data-review-menu]").forEach((item) => item.setAttribute("aria-expanded", "false"));
      syncReviewSummaries();
      return;
    }

    if (!event.target.closest("[data-review-menu-root]")) {
      document.querySelectorAll("[data-review-panel]").forEach((item) => item.classList.add("hidden"));
      document.querySelectorAll("[data-review-menu]").forEach((item) => item.setAttribute("aria-expanded", "false"));
    }

    const deleteAssetButton = event.target.closest("[data-delete-asset-id]");
    if (deleteAssetButton) {
      deleteAsset(deleteAssetButton.dataset.deleteAssetId).catch((error) => showToast(error.message));
      return;
    }

    const previewButton = event.target.closest("[data-preview-image]");
    if (previewButton) {
      el("imagePreviewTitle").textContent = previewButton.dataset.previewTitle || "故事板预览";
      el("imagePreviewContent").src = previewButton.dataset.previewImage;
      el("imagePreviewDialog").showModal();
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
      "view-export": () => {
        state.viewStatus = "export";
        renderWorkspace();
      },
      "view-visual": () => {
        state.viewStatus = "visual";
        renderWorkspace();
      },
      "confirm-and-generate-visual": () => confirmScriptAndGenerateVisual(),
      "generate-script": () => generateScript(),
      "generate-visual": () => generateVisual()
    };
    actions[actionButton.dataset.action]?.();
  });

  el("projectList").addEventListener("click", (event) => {
    const checkbox = event.target.closest("[data-project-select-id]");
    if (checkbox) {
      toggleProjectSelection(checkbox.dataset.projectSelectId, checkbox.checked);
      return;
    }

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

  el("projectBulkActions").addEventListener("click", (event) => {
    if (event.target.closest("[data-project-bulk-start]")) {
      startProjectBatchDelete();
      return;
    }
    if (event.target.closest("[data-project-select-all]")) {
      toggleProjectSelection("__all__", true);
      return;
    }
    if (event.target.closest("[data-project-bulk-cancel]")) {
      cancelProjectBatchDelete();
      return;
    }
    if (event.target.closest("[data-project-bulk-delete]")) {
      deleteSelectedProjects();
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
    refreshProviderSettings().catch((error) => console.warn("Failed to refresh provider readiness.", error));
    await loadProjects();
    for (const project of state.projects) {
      try {
        await openProject(project.id);
        return;
      } catch (error) {
        console.warn("Skipping project that could not be opened.", project.id, error);
      }
    }
  } catch (error) {
    showToast(`本地服务连接失败：${error.message}`);
  }
}

boot();

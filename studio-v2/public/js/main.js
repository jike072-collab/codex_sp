import { el, showToast, state } from "./core.js";
import {
  analyze,
  confirmReview,
  createProject,
  loadProjects,
  openProject,
  uploadFiles
} from "./projects.js";
import { renderWorkspace } from "./render.js";

function wireEvents() {
  const openDialog = () => el("newProjectDialog").showModal();
  el("newProjectButton").addEventListener("click", openDialog);
  el("emptyCreateButton").addEventListener("click", openDialog);
  el("closeDialogButton").addEventListener("click", () => el("newProjectDialog").close());
  el("newProjectForm").addEventListener("submit", createProject);
  el("reviewForm").addEventListener("submit", confirmReview);
  el("analyzeButton").addEventListener("click", analyze);

  el("backToAssetsButton").addEventListener("click", () => {
    state.project.status = "assets";
    renderWorkspace();
  });
  el("editReviewButton").addEventListener("click", () => {
    state.project.status = "review";
    renderWorkspace();
  });

  el("projectList").addEventListener("click", (event) => {
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


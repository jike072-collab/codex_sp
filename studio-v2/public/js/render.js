import {
  countryNames,
  el,
  escapeHtml,
  formatTime,
  lines,
  state,
  statusLabel,
  valueAt
} from "./core.js";

export function renderProjectList() {
  const container = el("projectList");
  if (!state.projects.length) {
    container.innerHTML = `<div class="project-link"><small>还没有项目</small></div>`;
    return;
  }
  container.innerHTML = state.projects.map((project) => `
    <button class="project-link ${project.id === state.project?.id ? "active" : ""}"
      data-project-id="${escapeHtml(project.id)}" type="button">
      <strong>${escapeHtml(project.name)}</strong>
      <small>${statusLabel(project.status)} · ${formatTime(project.updatedAt)}</small>
    </button>
  `).join("");
}

export function renderWorkspace() {
  const project = state.project;
  if (!project) return;

  el("projectTitle").textContent = project.name;
  el("projectState").textContent = statusLabel(project.status);
  el("briefName").value = project.name;
  el("briefCountry").value = countryNames[project.targetCountry] || project.targetCountry;
  el("briefAudience").value = project.audience;

  renderAssets();
  renderStepper();

  el("assetsStage").classList.toggle("hidden", !["assets", "analyzing"].includes(project.status));
  el("reviewStage").classList.toggle("hidden", project.status !== "review");
  el("futureStage").classList.toggle(
    "hidden",
    !["market", "script", "visual", "export"].includes(project.status)
  );

  if (project.status === "review") fillReviewForm(project.visionAnalysis);
  if (project.reviewConfirmedAt) {
    el("confirmedTime").textContent = `确认时间：${formatTime(project.reviewConfirmedAt)}`;
  }
}

export function renderStepper() {
  const order = ["assets", "review", "market", "script", "visual", "export"];
  const current = Math.max(0, order.indexOf(state.project.status));
  document.querySelectorAll("#stepper li").forEach((item, index) => {
    item.classList.toggle("active", index === current);
    item.classList.toggle("complete", index < current);
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

function listText(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

export function fillReviewForm(analysis) {
  const form = el("reviewForm");
  const lock = analysis?.product_lock_manifest || {};
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
  const toeAndLace = lines(form.elements.toe_and_lace.value);
  const sole = lines(form.elements.sole_structure.value);
  const sideAndHeel = lines(form.elements.side_and_heel.value);

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


const state = {
  files: [],
  selectedNames: new Set(),
  pendingPreviewUrls: [],
  variantCount: 1,
  selectedRunId: "",
  planning: null,
  imagePackage: null,
  manualOmni: null,
  imageResults: null,
  batchItems: []
};

const el = (id) => document.getElementById(id);

function setLog(text) {
  el("logBox").textContent = text || "";
}

function appendLog(text) {
  el("logBox").textContent += `\n${text}`;
}

function setProgress(percent, label, activeStep = 1) {
  const value = Math.max(0, Math.min(100, percent));
  el("progressFill").style.width = `${value}%`;
  el("progressPercent").textContent = `${value}%`;
  el("progressLabel").textContent = label;
  document.querySelectorAll(".step").forEach((step) => {
    const stepNumber = Number(step.dataset.step);
    step.classList.toggle("active", stepNumber <= activeStep);
  });
}

async function apiJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function imageUrl(fileName) {
  return `/input_files/${encodeURIComponent(fileName)}`;
}

async function loadFiles() {
  const data = await apiJson("/api/files");
  state.files = Array.isArray(data.files) ? data.files : data.files ? [data.files] : [];
  const available = new Set(state.files.map((file) => file.name));
  state.selectedNames = new Set(Array.from(state.selectedNames).filter((name) => available.has(name)));
  clearPendingPreviews();
  renderFiles();
}

async function loadSettings() {
  try {
    const settings = await apiJson("/api/settings");
    el("visionModel").value = settings.VISION_MODEL || "gpt-5.4-mini";
    el("visionApiUrl").value = settings.VISION_API_URL || "https://api.openai.com/v1/chat/completions";
    el("textModel").value = settings.TEXT_MODEL || "deepseek-chat";
    el("textApiUrl").value = settings.TEXT_API_URL || "https://api.deepseek.com/chat/completions";
    el("imageModel").value = settings.IMAGE_MODEL || "img2";
    el("imageApiUrl").value = settings.IMAGE_API_URL || "";
    el("visionApiKey").placeholder = settings.hasVisionKey ? "已设置，留空不修改" : "留空则不修改";
    el("textApiKey").placeholder = settings.hasTextKey ? "已设置，留空不修改" : "留空则不修改";
    el("imageApiKey").placeholder = settings.hasImageKey ? "已设置，留空不修改" : "留空则不修改";
  } catch (error) {
    appendLog(`读取 API 设置失败：${error.message}`);
  }
}

function renderFiles() {
  const grid = el("imageGrid");
  const template = el("imageCardTemplate");
  grid.innerHTML = "";

  if (!state.files.length) {
    grid.innerHTML = `<div class="empty-state">还没有商品图。</div>`;
    renderDropPreview();
    return;
  }

  state.files.forEach((file) => {
    const node = template.content.cloneNode(true);
    const label = node.querySelector(".image-card");
    const input = node.querySelector("input");
    const img = node.querySelector("img");
    const span = node.querySelector("span");
    input.value = file.name;
    input.checked = state.selectedNames.has(file.name);
    img.src = imageUrl(file.name);
    img.alt = file.name;
    span.textContent = file.name;
    label.dataset.file = file.name;
    input.addEventListener("change", () => {
      if (input.checked) {
        state.selectedNames.add(file.name);
      } else {
        state.selectedNames.delete(file.name);
      }
      renderDropPreview();
    });
    grid.appendChild(node);
  });
  renderDropPreview();
}

function renderDropPreview() {
  const preview = el("dropPreview");
  const placeholder = el("dropPlaceholder");
  if (state.pendingPreviewUrls.length) {
    placeholder.hidden = true;
    preview.hidden = false;
    preview.innerHTML = state.pendingPreviewUrls.map((url) => `
      <div class="current-image pending">
        <img src="${url}" alt="正在上传的鞋图">
      </div>
    `).join("");
    return;
  }
  const selected = selectedImages();
  placeholder.hidden = selected.length > 0;
  preview.hidden = selected.length === 0;
  preview.innerHTML = selected.map((name) => `
    <div class="current-image">
      <img src="${imageUrl(name)}" alt="${escapeHtml(name)}">
      <button type="button" class="remove-image-btn" data-remove-image="${escapeHtml(name)}" title="移出当前任务" aria-label="移出当前任务">×</button>
    </div>
  `).join("");
}

function setPendingPreviews(files) {
  clearPendingPreviews();
  state.pendingPreviewUrls = files.map((file) => URL.createObjectURL(file));
  renderDropPreview();
}

function clearPendingPreviews() {
  state.pendingPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
  state.pendingPreviewUrls = [];
}

function selectedImages() {
  return Array.from(state.selectedNames);
}

function setAllImageChecks(checked) {
  state.selectedNames = checked
    ? new Set(state.files.map((file) => file.name))
    : new Set();
  renderFiles();
  renderDropPreview();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function clearHistory() {
  if (!state.files.length) {
    setLog("上传历史已经是空的。");
    return;
  }

  const ok = window.confirm("确认清除上传历史吗？这会删除 input_files 里的鞋图文件，但不会删除 reference_examples。");
  if (!ok) return;

  setProgress(8, "正在清除上传历史", 1);
  try {
    const result = await apiJson("/api/clear-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    state.selectedNames.clear();
    setLog(`已清除 ${result.deleted.length} 张历史鞋图。`);
    await loadFiles();
    setProgress(0, "等待开始", 1);
  } catch (error) {
    setLog(`清除失败：${error.message}`);
  }
}

async function saveSettings() {
  const payload = {
    VISION_MODEL: el("visionModel").value,
    VISION_API_URL: el("visionApiUrl").value,
    VISION_MODEL_API_KEY: el("visionApiKey").value,
    TEXT_MODEL: el("textModel").value,
    TEXT_API_URL: el("textApiUrl").value,
    TEXT_MODEL_API_KEY: el("textApiKey").value,
    IMAGE_MODEL: el("imageModel").value,
    IMAGE_API_URL: el("imageApiUrl").value,
    IMAGE_MODEL_API_KEY: el("imageApiKey").value
  };

  setLog("正在保存 API 设置...");
  try {
    await apiJson("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    el("visionApiKey").value = "";
    el("textApiKey").value = "";
    el("imageApiKey").value = "";
    await loadSettings();
    setLog("API 设置已保存到本地 .env。");
    el("settingsDialog").close();
  } catch (error) {
    setLog(`保存 API 设置失败：${error.message}`);
  }
}

async function loadRuns() {
  const data = await apiJson("/api/runs");
  const select = el("runSelect");
  select.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "选择历史输出";
  select.appendChild(empty);

  const runs = Array.isArray(data.runs) ? data.runs : data.runs ? [data.runs] : [];
  runs.forEach((run) => {
    const option = document.createElement("option");
    option.value = run.id;
    option.textContent = formatRunLabel(run.id);
    select.appendChild(option);
  });
}

function formatRunLabel(runId) {
  const match = String(runId).match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (!match) return runId;
  return `${match[2]}-${match[3]} ${match[4]}:${match[5]} · 商品任务`;
}

async function runWorkflow() {
  const images = selectedImages();
  if (!images.length) {
    setLog("至少选择一张真实鞋图。");
    return;
  }

  const payload = {
    images,
    targetCountry: el("targetCountry").value,
    brandName: "",
    audience: el("audience").value,
    variantCount: state.variantCount,
    concurrency: Math.min(4, Math.max(1, images.length * state.variantCount)),
    mockText: el("mockText").checked,
    mockImages: el("mockImages").checked
  };

  el("runBtn").disabled = true;
  state.batchItems = images.flatMap((image) => Array.from(
    { length: state.variantCount },
    (_, index) => ({
      image,
      variantIndex: index + 1,
      variantCount: state.variantCount,
      status: "queued"
    })
  ));
  renderBatchResults();
  setProgress(12, `准备生成 ${state.batchItems.length} 个创意版本`, 1);
  setLog(`已提交 ${images.length} 个商品，每个生成 ×${state.variantCount} 个不同脚本，共 ${state.batchItems.length} 个任务。`);

  const progressTimer = window.setInterval(() => {
    const current = Number(el("progressPercent").textContent.replace("%", ""));
    if (current < 90) {
      const next = current + 4;
      const label = next < 35
        ? "GPT 正在识别鞋图与锁定产品"
        : next < 65
          ? "DeepSeek 正在生成卖点与脚本"
          : next < 86
            ? "img2 正在生成故事板与关键帧"
            : "正在整理每个商品的复制包";
      const step = next < 35 ? 1 : next < 65 ? 2 : next < 86 ? 3 : 4;
      setProgress(next, label, step);
    }
  }, 900);

  try {
    const result = await apiJson("/api/run-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    state.batchItems = result.items || state.batchItems;
    renderBatchResults();
    const finalStatus = await waitForBatch(result.jobId);
    window.clearInterval(progressTimer);
    state.batchItems = finalStatus.items || [];
    renderBatchResults();
    const completed = state.batchItems.filter((item) => item.status === "completed");
    const failed = state.batchItems.filter((item) => item.status !== "completed");
    setProgress(100, `完成 ${completed.length}/${state.batchItems.length} 个版本`, 4);
    setLog(`批量任务完成：成功 ${completed.length} 个版本，失败 ${failed.length} 个。`);
    await loadRuns();
    if (completed.length) {
      state.selectedRunId = completed[0].runId;
      el("runSelect").value = completed[0].runId;
      await loadRun(completed[0].runId);
      switchTab("omni");
    }
  } catch (error) {
    window.clearInterval(progressTimer);
    setProgress(0, "运行失败", 1);
    setLog(`运行失败：${error.message}`);
    state.batchItems = state.batchItems.map((item) => ({ ...item, status: "failed" }));
    renderBatchResults();
  } finally {
    el("runBtn").disabled = false;
  }
}

async function waitForBatch(jobId) {
  while (true) {
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    const status = await apiJson(`/api/batch-status?jobId=${encodeURIComponent(jobId)}`);
    if (status.items?.length) {
      state.batchItems = status.items;
      renderBatchResults();
      const finished = Number(status.completed || 0) + Number(status.failed || 0);
      const total = Number(status.total || status.items.length || 1);
      const taskProgress = Math.round((finished / total) * 76) + 14;
      setProgress(Math.min(94, taskProgress), `已完成 ${finished}/${total} 个版本`, finished ? 3 : 1);
    }
    if (status.status === "completed") {
      return status;
    }
  }
}

function renderBatchResults() {
  const container = el("batchResults");
  if (!state.batchItems.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="batch-head">
      <strong>批量队列</strong>
      <span>${state.batchItems.length} 个创意版本</span>
    </div>
    <div class="batch-list">
      ${state.batchItems.map((item) => {
        const status = item.status === "completed"
          ? "已完成"
          : item.status === "failed"
            ? "失败"
            : item.status === "queued"
              ? "等待中"
              : "处理中";
        return `
          <article class="batch-item ${escapeHtml(item.status || "running")}">
            <img src="${imageUrl(item.image)}" alt="">
            <div>
              <strong>${escapeHtml(status)} · ×${escapeHtml(item.variantIndex || 1)}</strong>
              <small>${escapeHtml(item.runId || "正在生成运行编号")}</small>
            </div>
            ${item.status === "completed" ? `<button class="mini-btn" data-run-id="${escapeHtml(item.runId)}">查看</button>` : ""}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

async function loadRun(runId) {
  if (!runId) return;
  state.selectedRunId = runId;

  const [planning, imagePackage, manualOmni, imageResults] = await Promise.all([
    apiJson(`/api/run-data?runId=${encodeURIComponent(runId)}&file=planning-package.json`),
    apiJson(`/api/run-data?runId=${encodeURIComponent(runId)}&file=image-package.json`),
    apiJson(`/api/run-data?runId=${encodeURIComponent(runId)}&file=manual-omni-package.json`),
    apiJson(`/api/run-data?runId=${encodeURIComponent(runId)}&file=image-results.json`)
  ]);

  state.planning = planning;
  state.imagePackage = imagePackage;
  state.manualOmni = manualOmni;
  state.imageResults = imageResults;
  renderRun();
  setProgress(100, "已加载历史输出", 4);
}

function renderRun() {
  renderMeta();
  renderPlanning();
  renderOmni();
}

function renderMeta() {
  const locale = state.planning?.locale_profile || {};
  el("resultMeta").innerHTML = `
    <span class="pill">${escapeHtml(countryLabel(locale.target_country || "-"))}</span>
    <span class="pill">${escapeHtml(locale.language || "-")}</span>
    <span class="pill">2 段 × 10 秒</span>
  `;
}

function countryLabel(value) {
  const map = {
    Thailand: "泰国",
    Indonesia: "印尼",
    Vietnam: "越南",
    Philippines: "菲律宾",
    Malaysia: "马来西亚",
    Singapore: "新加坡"
  };
  return map[value] || value;
}

function renderPlanning() {
  const container = el("tab-planning");
  const planning = state.planning;
  if (!planning) {
    container.innerHTML = `<div class="empty-state">暂无脚本输出。</div>`;
    return;
  }

  const points = planning.selling_points || [];
  const direction = planning.creative_direction || {};
  const lock = planning.product_lock_manifest || {};
  const script = planning.script_20s || {};

  container.innerHTML = `
    <div class="summary-grid">
      <article class="summary-card">
        <h3>创意方向</h3>
        <p class="muted">${escapeHtml(direction.video_positioning || "")}</p>
        <p><strong>${escapeHtml(direction.recommended_theme || "")}</strong></p>
      </article>
      <article class="summary-card">
        <h3>产品锁定</h3>
        <ul class="point-list">
          ${(lock.must_keep || []).slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </article>
      <article class="summary-card">
        <h3>卖点</h3>
        <ul class="point-list">
          ${points.map((item) => `<li>${escapeHtml(item.point)} <span class="muted">(${escapeHtml(item.evidence)})</span></li>`).join("")}
        </ul>
      </article>
      <article class="summary-card">
        <h3>禁改项</h3>
        <ul class="point-list">
          ${(lock.must_not_change || []).slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </article>
    </div>
    ${renderSegment(script.segment_a_0_10s)}
    ${renderSegment(script.segment_b_10_20s)}
  `;
}

function renderSegment(segment) {
  if (!segment) return "";
  const shots = segment.shots || [];
  return `
    <h3 class="segment-title">${escapeHtml(segment.segment_id)}｜${escapeHtml(segment.theme || "")}</h3>
    <div class="shot-grid">
      ${shots.map((shot) => `
        <article class="shot-card">
          <h3>${escapeHtml(shot.start_sec)}-${escapeHtml(shot.end_sec)}s</h3>
          <p>${escapeHtml(shot.visual || "")}</p>
          <p class="muted">${escapeHtml(shot.localized_caption_or_vo || "")}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderOmni() {
  const container = el("tab-omni");
  const packages = Array.isArray(state.manualOmni) ? state.manualOmni : [];
  if (!packages.length) {
    container.innerHTML = `<div class="empty-state">暂无复制包。运行流程后，这里会出现 0-10 秒和 10-20 秒两段可复制文案。</div>`;
    return;
  }

  container.innerHTML = `
    <div class="prompt-list">
      ${packages.map((pkg) => {
        const copyText = buildOmniCopyText(pkg);
        return `
          <article class="copy-card">
            <div class="copy-card-head">
              <div>
                <p class="eyebrow">Flow Omni</p>
                <h3>${pkg.segment_id === "0-10s" ? "第 1 段" : "第 2 段"} · ${escapeHtml(pkg.segment_id)}</h3>
              </div>
              <button class="primary-copy-btn" data-omni="${escapeHtml(pkg.segment_id)}">一键复制</button>
            </div>
            <p class="omni-use">Flow 上传：对应故事板图、关键帧图、原鞋图。下方文案已包含该段 10 秒脚本。</p>
            <textarea class="copy-text" readonly id="omni-${escapeHtml(pkg.segment_id)}">${escapeHtml(copyText)}</textarea>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function buildOmniCopyText(pkg) {
  const segment = pkg.script || {};
  const shots = segment.shots || [];
  const shotText = shots.map((shot, index) => {
    return `${index + 1}. ${shot.start_sec}-${shot.end_sec}s：${shot.visual || ""}；动作：${shot.action || ""}；镜头：${shot.camera || ""}；字幕/口播：${shot.localized_caption_or_vo || ""}；声音：${shot.sound || ""}`;
  }).join("\n");

  return [
    `【${pkg.segment_id} 鞋类电商广告视频生成】`,
    "",
    "请根据我上传的三类参考生成这一段 10 秒视频：故事板图控制镜头顺序和剧情，关键帧图控制画面风格，鞋子产品图锁定鞋型、颜色、中底、外底、侧面图案和 logo。",
    "",
    "10 秒脚本：",
    shotText || "使用对应 10 秒脚本。",
    "",
    "视频生成要求：",
    "画面要连贯、节奏像标准电商广告，产品始终清楚可辨认。不要换鞋型，不要换颜色，不要新增错误 logo，不要改变鞋底结构。视频画面里不要生成大段文字，字幕后期再加。"
  ].join("\n");
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  appendLog("已复制到剪贴板。");
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("active"));
  el(`tab-${tabName}`).classList.add("active");
}

async function uploadFileList(fileList) {
  const pickedFiles = Array.from(fileList || []).filter((file) => {
    return file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);
  });
  if (!pickedFiles.length) {
    setLog("请先选择或拖入鞋子图片。");
    return;
  }

  setPendingPreviews(pickedFiles);
  setProgress(10, "正在上传鞋图", 1);
  setLog("正在上传鞋图...");

  try {
    const files = [];
    for (const file of pickedFiles) {
      files.push({
        name: file.name,
        dataUrl: await fileToDataUrl(file)
      });
    }

    const result = await apiJson("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files })
    });

    const savedFiles = Array.isArray(result.files) ? result.files : result.files ? [result.files] : [];
    const duplicateFiles = Array.isArray(result.duplicates)
      ? result.duplicates
      : result.duplicates
        ? [result.duplicates]
        : [];
    const duplicateCount = duplicateFiles.length;
    savedFiles.forEach((file) => state.selectedNames.add(file.name));
    duplicateFiles.forEach((file) => {
      if (file.duplicateOf) state.selectedNames.add(file.duplicateOf);
    });
    setLog(duplicateCount
      ? `新增 ${savedFiles.length} 张，已跳过 ${duplicateCount} 张重复图片。`
      : `上传完成：${savedFiles.length} 张。`);
    setProgress(18, "鞋图已上传", 1);
    el("imageUpload").value = "";
    await loadFiles();
  } catch (error) {
    clearPendingPreviews();
    renderDropPreview();
    setLog(`上传失败：${error.message}`);
    setProgress(0, "上传失败", 1);
  }
}

function setHistoryView(mode) {
  const grid = el("imageGrid");
  const large = mode === "large";
  grid.classList.toggle("large-view", large);
  grid.classList.toggle("compact-view", !large);
  el("largeViewBtn").classList.toggle("active-view", large);
  el("compactViewBtn").classList.toggle("active-view", !large);
}

function wireDropZone() {
  const zone = el("dropZone");
  const input = el("imageUpload");

  input.addEventListener("change", () => uploadFileList(input.files));
  zone.addEventListener("click", (event) => {
    if (event.target.closest("[data-remove-image]")) return;
    input.click();
  });
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();
      zone.classList.remove("dragging");
    });
  });

  zone.addEventListener("drop", (event) => {
    uploadFileList(event.dataTransfer.files);
  });
}

function wireEvents() {
  el("openSettingsBtn").addEventListener("click", () => el("settingsDialog").showModal());
  el("closeSettingsBtn").addEventListener("click", () => el("settingsDialog").close());
  el("openHistoryBtn").addEventListener("click", async () => {
    await loadFiles();
    el("historyDialog").showModal();
  });
  el("closeHistoryBtn").addEventListener("click", () => el("historyDialog").close());
  el("compactViewBtn").addEventListener("click", () => setHistoryView("compact"));
  el("largeViewBtn").addEventListener("click", () => setHistoryView("large"));
  el("selectAllBtn").addEventListener("click", () => setAllImageChecks(true));
  el("clearSelectionBtn").addEventListener("click", () => setAllImageChecks(false));
  el("clearHistoryBtn").addEventListener("click", clearHistory);
  el("saveSettingsBtn").addEventListener("click", saveSettings);
  el("runBtn").addEventListener("click", runWorkflow);
  el("runSelect").addEventListener("change", (event) => loadRun(event.target.value));
  el("variantPicker").addEventListener("click", (event) => {
    const button = event.target.closest("[data-variant-count]");
    if (!button) return;
    state.variantCount = Number(button.dataset.variantCount);
    document.querySelectorAll(".variant-btn").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
  });

  document.querySelector(".tabs").addEventListener("click", (event) => {
    const button = event.target.closest(".tab");
    if (!button) return;
    switchTab(button.dataset.tab);
  });

  document.body.addEventListener("click", (event) => {
    const removeImage = event.target.closest("[data-remove-image]");
    if (removeImage) {
      event.preventDefault();
      event.stopPropagation();
      state.selectedNames.delete(removeImage.dataset.removeImage);
      renderFiles();
      return;
    }

    const runButton = event.target.closest("[data-run-id]");
    if (runButton) {
      const runId = runButton.dataset.runId;
      el("runSelect").value = runId;
      loadRun(runId);
      switchTab("omni");
      return;
    }

    const copyOmni = event.target.closest("[data-omni]");
    if (copyOmni) {
      const id = copyOmni.dataset.omni;
      return copyText(el(`omni-${id}`).value);
    }
  });
}

async function boot() {
  wireEvents();
  wireDropZone();
  setProgress(0, "等待开始", 1);
  try {
    await Promise.all([loadFiles(), loadSettings()]);
    window.setTimeout(() => {
      loadRuns().catch((error) => appendLog(`读取历史输出失败：${error.message}`));
    }, 0);
  } catch (error) {
    el("serverState").textContent = "连接异常";
    el("serverState").classList.add("error");
    setLog(error.message);
  }
}

boot();

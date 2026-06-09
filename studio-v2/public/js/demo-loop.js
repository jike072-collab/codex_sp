import {
  countryNames,
  el,
  escapeHtml,
  formatTime,
  state
} from "./core.js";

const SHOT_FIELDS = [
  ["visual", "画面"],
  ["action", "动作"],
  ["camera", "镜头"],
  ["selling_point", "卖点"],
  ["localized_caption_or_vo", "口播/字幕"],
  ["sound", "音效"],
  ["transition", "转场"]
];

const SEGMENTS = [
  ["segment_a_0_10s", "0-10s"],
  ["segment_b_10_20s", "10-20s"]
];

const THEME_LABELS = {
  "city-motion": "城市动线",
  "daily-comfort": "全天舒适",
  "performance-detail": "性能细节",
  "street-style": "街头风格"
};

function clean(value) {
  return String(value || "").trim();
}

function marketTitle(project) {
  const brief = project.marketBrief || {};
  const country = countryNames[brief.targetCountry] || brief.targetCountry || "目标市场";
  const theme = THEME_LABELS[brief.creativeTheme] || brief.creativeTheme || "创意方向";
  return `${country} · ${theme}`;
}

function shotSummaryText(shot) {
  return SHOT_FIELDS.map(([field, label]) => `${label}：${shot[field] || ""}`).join("\n");
}

function parseShotSummary(value, previousShot) {
  const nextShot = { ...previousShot };
  const lines = String(value || "").split(/\r?\n/);
  for (const [field, label] of SHOT_FIELDS) {
    const prefix = `${label}：`;
    const line = lines.find((item) => item.trim().startsWith(prefix));
    if (line) nextShot[field] = clean(line.slice(prefix.length));
  }
  if (!lines.some((line) => line.includes("："))) {
    nextShot.visual = clean(value) || nextShot.visual;
  }
  return nextShot;
}

function segmentCopy(segment) {
  const shots = Array.isArray(segment?.shots) ? segment.shots : [];
  return [
    `${segment.segment_id}｜${segment.theme}`,
    ...shots.map((shot, index) => [
      `${index + 1}. ${shot.start_sec}-${shot.end_sec}s`,
      `画面：${shot.visual}`,
      `动作：${shot.action}`,
      `镜头：${shot.camera}`,
      `卖点：${shot.selling_point}`,
      `音效：${shot.sound}`,
      `口播：${shot.localized_caption_or_vo}`,
      `字幕：${shot.localized_caption_or_vo}`,
      `转场：${shot.transition}`
    ].join("\n"))
  ].join("\n\n");
}

function scriptSegmentById(project, segmentId) {
  const script = project.planningPackage?.script_20s || {};
  return segmentId === "0-10s"
    ? script.segment_a_0_10s
    : script.segment_b_10_20s;
}

function renderShotEditor(segmentKey, shot, shotIndex) {
  return `
    <article class="shot-card compact-shot">
      <div class="shot-meta">
        <strong>${escapeHtml(shot.start_sec)}-${escapeHtml(shot.end_sec)}s</strong>
        <span>镜头 ${shotIndex + 1}</span>
      </div>
      <textarea class="shot-summary-box" data-segment="${escapeHtml(segmentKey)}"
        data-shot-index="${shotIndex}"
        data-shot-summary="true">${escapeHtml(shotSummaryText(shot))}</textarea>
    </article>
  `;
}

function renderSegmentEditor(segmentKey, segment) {
  const shots = Array.isArray(segment?.shots) ? segment.shots : [];
  return `
    <section class="segment-card compact-segment">
      <div class="segment-heading">
        <div>
          <p class="section-index">${escapeHtml(segment.segment_id || "")}</p>
          <h3>${escapeHtml(segment.theme || "脚本分段")}</h3>
        </div>
        <span class="requirement">${escapeHtml(segment.duration_sec || 10)} 秒</span>
      </div>
      <label>
        <span>分段主题</span>
        <input data-segment="${escapeHtml(segmentKey)}"
          data-field="theme"
          value="${escapeHtml(segment.theme || "")}">
      </label>
      <div class="shot-list">
        ${shots.map((shot, index) => renderShotEditor(segmentKey, shot, index)).join("")}
      </div>
    </section>
  `;
}

function renderGenerateScript(project) {
  return `
    <div class="future-content script-start-panel">
      <p class="section-index">STEP 04</p>
      <h2>市场创意已确认</h2>
      <p>选择每个 10 秒段落的镜头数，然后生成 20 秒脚本。后续会按两个 10 秒段落分别生成故事板。</p>
      <div class="confirmed-card">
        <span>✓</span>
        <div>
          <strong>${escapeHtml(marketTitle(project))}</strong>
          <small>${project.marketConfirmedAt ? `保存时间：${formatTime(project.marketConfirmedAt)}` : "市场 brief 已保存。"}</small>
        </div>
      </div>
      <div class="shot-count-picker" role="radiogroup" aria-label="每 10 秒镜头数">
        ${[3, 4, 5].map((count) => `
          <label class="choice-card inline">
            <input type="radio" name="shotsPerSegment" value="${count}" ${count === 5 ? "checked" : ""}>
            <span><strong>${count} 个镜头</strong><small>每 10 秒一组</small></span>
          </label>
        `).join("")}
      </div>
      <div class="script-progress" id="scriptProgress" hidden>
        <span></span>
        <p>正在生成两个 10 秒脚本段落，请稍候...</p>
      </div>
      <div class="button-row">
        <button class="ghost-button" type="button" data-action="edit-market">返回第二步调整</button>
        <button class="primary-button" id="generateScriptButton" type="button" data-action="generate-script">生成演示脚本</button>
      </div>
    </div>
  `;
}

function renderScriptEditor(project) {
  const planning = project.planningPackage || {};
  const script = planning.script_20s || {};
  return `
    <div class="section-heading">
      <div>
        <p class="section-index">STEP 04</p>
        <h2>编辑广告脚本</h2>
        <p>脚本结构按“画面、动作、镜头、卖点、口播/字幕、音效、转场”整理。确认后会直接进入最终交付页并生成两张故事板。</p>
      </div>
      <span class="requirement">20 秒</span>
    </div>
    <form id="scriptForm" novalidate>
      <div class="workflow-panel">
        <div>
          <p class="section-index">MARKET BRIEF</p>
          <h3>${escapeHtml(marketTitle(project))}</h3>
        </div>
        <p>${escapeHtml(project.marketBrief?.coreMessage || "")}</p>
      </div>
      ${SEGMENTS.map(([segmentKey]) => renderSegmentEditor(segmentKey, script[segmentKey] || {})).join("")}
      <div class="stage-actions">
        <button class="text-button" type="button" data-action="edit-market">返回第二步调整</button>
        <div class="action-cluster">
          <p id="scriptHint">确认后生成两个分段故事板。</p>
          <button class="primary-button" id="confirmAndGenerateButton" type="button"
            data-action="confirm-and-generate-visual">确认脚本并生成故事板图片</button>
        </div>
      </div>
    </form>
  `;
}

export function renderScriptStage(project = state.project) {
  const container = el("scriptStageContent");
  if (!container || !project) return;
  container.innerHTML = project.planningPackage
    ? renderScriptEditor(project)
    : renderGenerateScript(project);
}

export function planningPackageFromForm(project = state.project) {
  const planning = structuredClone(project.planningPackage || {});
  const script = planning.script_20s || {};
  for (const [segmentKey] of SEGMENTS) {
    const segment = script[segmentKey];
    if (!segment) continue;
    const themeInput = document.querySelector(`[data-segment="${segmentKey}"][data-field="theme"]`);
    segment.theme = clean(themeInput?.value);
    segment.shots = segment.shots.map((shot, shotIndex) => {
      const summaryInput = document.querySelector(
        `[data-segment="${segmentKey}"][data-shot-index="${shotIndex}"][data-shot-summary="true"]`
      );
      return parseShotSummary(summaryInput?.value, shot);
    });
  }
  return planning;
}

export function validatePlanningPackage(planning) {
  const script = planning?.script_20s || {};
  for (const [segmentKey, segmentLabel] of SEGMENTS) {
    const segment = script[segmentKey];
    if (!clean(segment?.theme)) return `请填写 ${segmentLabel} 分段主题。`;
    const shots = Array.isArray(segment.shots) ? segment.shots : [];
    if (!shots.length) return `${segmentLabel} 至少需要一个镜头。`;
    for (const [shotIndex, shot] of shots.entries()) {
      for (const [field, label] of SHOT_FIELDS) {
        if (!clean(shot[field])) return `请填写 ${segmentLabel} 镜头 ${shotIndex + 1} 的${label}。`;
      }
    }
  }
  return "";
}

export function renderVisualStage(project = state.project) {
  const container = el("visualStageContent");
  if (!container || !project) return;
  container.innerHTML = `
    <div class="future-content">
      <p class="section-index">STEP 05</p>
      <h2>故事板图片</h2>
      <p>此步骤只生成两个分段故事板。生成时会直接进入最终交付页显示进度。</p>
      <div class="confirmed-card">
        <span>✓</span>
        <div>
          <strong>广告脚本已确认</strong>
          <small>${project.scriptConfirmedAt ? `确认时间：${formatTime(project.scriptConfirmedAt)}` : "脚本已保存。"}</small>
        </div>
      </div>
      <button class="primary-button" id="generateVisualButton" type="button" data-action="generate-visual">生成故事板图片</button>
    </div>
  `;
}

function renderExportProgress(project) {
  return `
    <div class="future-content script-start-panel">
      <p class="section-index">FINAL DELIVERY</p>
      <h2>正在生成故事板图片</h2>
      <p>会生成两个故事板：0-10 秒和 10-20 秒。尺寸使用你在第二步选择的 ${escapeHtml(project.marketBrief?.outputAspectRatio || "9:16")}。</p>
      <div class="script-progress active">
        <span></span>
        <p>正在调用图片模型生成故事板，请稍候...</p>
      </div>
    </div>
  `;
}

function selectedStoryboardItems(project) {
  const selectedRatio = project.marketBrief?.outputAspectRatio || "9:16";
  const items = project.imagePackage?.image_generation || [];
  return ["0-10s", "10-20s"]
    .map((segmentId) => items.find((item) =>
      item.segment_id === segmentId &&
      item.type === "storyboard_board" &&
      item.aspect_ratio === selectedRatio
    ))
    .filter(Boolean);
}

function renderExportMismatch(project) {
  const selectedRatio = project.marketBrief?.outputAspectRatio || "9:16";
  return `
    <div class="future-content script-start-panel visual-error-card">
      <p class="section-index">FINAL DELIVERY</p>
      <h2>故事板尺寸需要重新生成</h2>
      <p>这个项目里保存的是旧版视觉结果，和第二步选择的 ${escapeHtml(selectedRatio)} 不一致。点击下面按钮会覆盖旧结果，只生成两张 ${escapeHtml(selectedRatio)} 故事板。</p>
      <button class="primary-button" id="generateVisualButton" type="button" data-action="generate-visual">重新生成当前尺寸故事板</button>
    </div>
  `;
}

function renderExportError(project) {
  return `
    <div class="future-content script-start-panel visual-error-card">
      <p class="section-index">FINAL DELIVERY</p>
      <h2>故事板图片生成失败</h2>
      <p>脚本已经保存，尺寸仍使用第二步选择的 ${escapeHtml(project.marketBrief?.outputAspectRatio || "9:16")}。请检查图片模型 Key 或模型权限后重试。</p>
      <div class="error-message">${escapeHtml(state.visualGenerationError)}</div>
      <button class="primary-button" id="generateVisualButton" type="button" data-action="generate-visual">重新生成故事板图片</button>
    </div>
  `;
}

function renderStoryboardImage(item) {
  if (!item.generated_image?.url) {
    return `<div class="generated-image-preview"><span>${escapeHtml(item.aspect_ratio || "")}</span></div>`;
  }
  return `
    <button class="generated-image-preview clickable-preview" type="button"
      data-preview-image="${escapeHtml(item.generated_image.url)}"
      data-preview-title="${escapeHtml(`${item.segment_id} 故事板 · ${item.aspect_ratio}`)}">
      <img src="${escapeHtml(item.generated_image.url)}" alt="${escapeHtml(item.asset_id)}">
    </button>
  `;
}

function renderDeliverable(project, item, index) {
  const segment = scriptSegmentById(project, item.segment_id) || {};
  const scriptText = item.script_copy || segmentCopy(segment);
  return `
    <article class="deliverable-card">
      <div class="segment-heading">
        <div>
          <p class="section-index">${escapeHtml(item.segment_id)}</p>
          <h3>${escapeHtml(item.segment_id)} 故事板 · ${escapeHtml(item.aspect_ratio)}</h3>
        </div>
        <button class="ghost-button small" type="button" data-copy-target="segmentScript${index}">复制脚本</button>
      </div>
      ${renderStoryboardImage(item)}
      <strong class="script-copy-title">对应脚本</strong>
      <pre id="segmentScript${index}">${escapeHtml(scriptText)}</pre>
    </article>
  `;
}

export function renderExportStage(project = state.project) {
  const container = el("exportStageContent");
  if (!container || !project) return;

  const rawImageItems = project.imagePackage?.image_generation || [];
  const imageItems = selectedStoryboardItems(project);
  if (imageItems.length !== 2) {
    container.innerHTML = state.visualGenerationError
      ? renderExportError(project)
      : rawImageItems.length
      ? renderExportMismatch(project)
      : renderExportProgress(project);
    return;
  }
  container.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="section-index">FINAL DELIVERY</p>
        <h2>最终交付</h2>
        <p>这里只保留你拿去生成视频需要的内容：两张故事板图片，以及各自对应的 10 秒脚本。</p>
      </div>
      <span class="requirement">${escapeHtml(imageItems.length)} 张故事板 · ${escapeHtml(project.marketBrief?.outputAspectRatio || imageItems[0]?.aspect_ratio || "")}</span>
    </div>
    <div class="export-actions">
      <button class="primary-button" type="button" data-action="download-export">下载 JSON 交付包</button>
    </div>
    <div class="deliverable-grid">
      ${imageItems.map((item, index) => renderDeliverable(project, item, index)).join("")}
    </div>
  `;
}

export function setWorkflowBusy(value, buttonId, busyText, idleText) {
  state.busy = value;
  const button = buttonId ? el(buttonId) : null;
  if (button) {
    button.disabled = value;
    button.textContent = value ? busyText : idleText;
  }
  el("saveState").textContent = value ? busyText : "已保存到本机";
}

export async function copyBlockText(targetId) {
  const source = el(targetId);
  const text = source?.textContent || "";
  if (!text) throw new Error("没有可复制的内容。");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) {
      const range = document.createRange();
      range.selectNodeContents(source);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      throw new Error("已选中内容，请按复制键复制。");
    }
  }
}

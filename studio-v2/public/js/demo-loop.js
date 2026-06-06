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
  ["localized_caption_or_vo", "本地化字幕/旁白"],
  ["sound", "声音"],
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

function prettyJson(value) {
  return JSON.stringify(value || {}, null, 2);
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

function marketTitle(project) {
  const brief = project.marketBrief || {};
  const country = countryNames[brief.targetCountry] || brief.targetCountry || "目标市场";
  const theme = THEME_LABELS[brief.creativeTheme] || brief.creativeTheme || "创意方向";
  return `${country} · ${theme}`;
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
    <div class="future-content">
      <p class="section-index">STEP 04</p>
      <h2>市场创意已确认</h2>
      <p>目标市场、受众和创意方向已经保存。现在可以生成本地演示脚本。</p>
      <div class="confirmed-card">
        <span>✓</span>
        <div>
          <strong>${escapeHtml(marketTitle(project))}</strong>
          <small>${project.marketConfirmedAt ? `保存时间：${formatTime(project.marketConfirmedAt)}` : "市场 brief 已保存。"}</small>
        </div>
      </div>
      <div class="button-row">
        <button class="ghost-button" type="button" data-action="edit-market">返回编辑市场创意</button>
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
        <p>快速扫一遍 20 秒脚本。确认后进入故事版图片阶段。</p>
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
        <button class="text-button" type="button" data-action="edit-market">返回市场创意</button>
        <div class="action-cluster">
          <p id="scriptHint">确认后直接生成故事版图片。</p>
          <button class="primary-button" id="confirmAndGenerateButton" type="button"
            data-action="confirm-and-generate-visual">确认脚本并生成故事版图片</button>
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
  const imageItems = project.imagePackage?.image_generation || [];
  if (imageItems.length) {
    container.innerHTML = renderGeneratedVisuals(project, imageItems);
    return;
  }
  container.innerHTML = `
    <div class="future-content">
      <p class="section-index">STEP 05</p>
      <h2>等待故事版图片</h2>
      <p>脚本已经确认。也可以在这里补生成故事版图、关键帧提示词和两段 Flow Omni 手动包。</p>
      <div class="confirmed-card">
        <span>✓</span>
        <div>
          <strong>广告脚本已确认</strong>
          <small>${project.scriptConfirmedAt ? `确认时间：${formatTime(project.scriptConfirmedAt)}` : "脚本已保存。"}</small>
        </div>
      </div>
      <button class="primary-button" id="generateVisualButton" type="button" data-action="generate-visual">生成故事版图片</button>
    </div>
  `;
}

function renderGeneratedVisuals(project, imageItems) {
  return `
    <div class="section-heading">
      <div>
        <p class="section-index">STEP 05</p>
        <h2>故事版图片</h2>
        <p>这里查看已经生成的故事版图、关键帧和对应提示词。</p>
      </div>
      <span class="requirement">${escapeHtml(imageItems.length)} 张/组</span>
    </div>
    <section class="form-section storage-settings">
      <h3>图片储存设置</h3>
      <div class="form-grid two">
        <label>
          <span>保存位置</span>
          <select>
            <option>本地项目目录</option>
            <option>稍后手动保存</option>
          </select>
        </label>
        <label>
          <span>文件命名</span>
          <input value="${escapeHtml(project.name)} · 分镜图片" readonly>
        </label>
      </div>
    </section>
    <div class="generated-image-grid">
      ${imageItems.map((item, index) => `
        <article class="generated-image-card">
          <div class="generated-image-preview">
            ${item.generated_image?.url
              ? `<img src="${escapeHtml(item.generated_image.url)}" alt="${escapeHtml(item.asset_id)}">`
              : `<span>${escapeHtml(item.aspect_ratio || "")}</span>`}
          </div>
          <div class="copy-header">
            <strong>${escapeHtml(item.asset_id)}</strong>
            <button class="ghost-button small" type="button" data-copy-target="visualPrompt${index}">复制提示词</button>
          </div>
          <pre id="visualPrompt${index}">${escapeHtml(prettyJson(item))}</pre>
        </article>
      `).join("")}
    </div>
  `;
}

function copyBlock(id, label, content) {
  return `
    <div class="copy-block">
      <div class="copy-header">
        <strong>${escapeHtml(label)}</strong>
        <button class="ghost-button small" type="button" data-copy-target="${escapeHtml(id)}">复制</button>
      </div>
      <pre id="${escapeHtml(id)}">${escapeHtml(content)}</pre>
    </div>
  `;
}

export function renderExportStage(project = state.project) {
  const container = el("exportStageContent");
  if (!container || !project) return;

  const imageItems = project.imagePackage?.image_generation || [];
  const omniPackages = project.manualOmniPackages || [];
  container.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="section-index">STEP 06</p>
        <h2>交付导出</h2>
        <p>故事版图、关键帧提示词和 Flow Omni 手动包已经生成，可以复制使用或下载完整 JSON 包。</p>
      </div>
      <span class="requirement">${escapeHtml(imageItems.length)} 条提示词</span>
    </div>
    <div class="export-actions">
      <button class="primary-button" type="button" data-action="download-export">下载 JSON 交付包</button>
    </div>
    <section class="form-section">
      <h3>故事版与关键帧包</h3>
      <div class="package-grid">
        ${imageItems.map((item, index) => copyBlock(
          `promptBlock${index}`,
          `${item.asset_id} · ${item.aspect_ratio}`,
          prettyJson(item)
        )).join("")}
      </div>
    </section>
    <section class="form-section">
      <h3>Flow Omni 手动包</h3>
      <div class="package-grid">
        ${omniPackages.map((item, index) => copyBlock(
          `omniBlock${index}`,
          `Segment ${item.segment_id}`,
          prettyJson(item)
        )).join("")}
      </div>
    </section>
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

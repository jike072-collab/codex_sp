import {
  countryNames,
  el,
  escapeHtml,
  formatTime,
  projectSetup,
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

function renderTimelineRow(segmentKey, segmentLabel, shot, shotIndex, timelineIndex) {
  return `
    <tr data-script-segment="${escapeHtml(segmentKey)}">
      <th scope="row">
        <span>${String(timelineIndex + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(shot.start_sec)}-${escapeHtml(shot.end_sec)}s</strong>
        <small>${escapeHtml(segmentLabel)}</small>
      </th>
      ${SHOT_FIELDS.map(([field, label]) => `
        <td>
          <textarea rows="1" aria-label="${escapeHtml(segmentLabel)} 镜头 ${shotIndex + 1} ${escapeHtml(label)}"
            data-segment="${escapeHtml(segmentKey)}"
            data-shot-index="${shotIndex}"
            data-shot-field="${escapeHtml(field)}">${escapeHtml(shot[field] || "")}</textarea>
        </td>
      `).join("")}
    </tr>
  `;
}

function renderScriptTimeline(script) {
  let timelineIndex = 0;
  return `
    <section class="script-timeline-card">
      <div class="script-theme-grid">
        ${SEGMENTS.map(([segmentKey, segmentLabel]) => {
          const segment = script[segmentKey] || {};
          return `
            <label>
              <span>${escapeHtml(segmentLabel)} 主题</span>
              <input data-segment="${escapeHtml(segmentKey)}"
                data-field="theme"
                value="${escapeHtml(segment.theme || "")}">
            </label>
          `;
        }).join("")}
      </div>
      <div class="script-timeline-table-wrap">
        <table class="script-timeline-table">
          <thead>
            <tr>
              <th scope="col">时间</th>
              ${SHOT_FIELDS.map(([, label]) => `<th scope="col">${escapeHtml(label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${SEGMENTS.flatMap(([segmentKey, segmentLabel]) => {
              const shots = Array.isArray(script[segmentKey]?.shots) ? script[segmentKey].shots : [];
              return shots.map((shot, shotIndex) =>
                renderTimelineRow(segmentKey, segmentLabel, shot, shotIndex, timelineIndex++)
              );
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderGenerateScript(project) {
  const shotsPerSegment = projectSetup(project).shotsPerSegment;
  return `
    <div class="future-content script-start-panel">
      <p class="section-index">STEP 03</p>
      <h2>市场创意已确认</h2>
      <p>将使用第二步选择的每段 ${escapeHtml(shotsPerSegment)} 个镜头生成 20 秒脚本。后续会按两个 10 秒段落分别生成故事板。</p>
      <div class="confirmed-card">
        <span>✓</span>
        <div>
          <strong>${escapeHtml(marketTitle(project))}</strong>
          <small>${project.marketConfirmedAt ? `保存时间：${formatTime(project.marketConfirmedAt)}` : "市场 brief 已保存。"}</small>
        </div>
      </div>
      <div class="script-progress" id="scriptProgress" hidden>
        <span><i class="workflow-progress-fill"></i></span>
        <strong>0%</strong>
        <p class="workflow-progress-message">正在整理市场语言与产品锁定...</p>
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
        <p class="section-index">STEP 03</p>
        <h2>编辑 20 秒广告脚本</h2>
        <p>全部镜头按时间顺序集中编辑；确认后仍按 0-10 秒和 10-20 秒生成两张故事板与两段交付脚本。</p>
      </div>
      <span class="requirement">20 秒</span>
    </div>
    <form id="scriptForm" novalidate>
      <div class="script-action-bar">
        <button class="ghost-button" type="button" data-action="edit-market">返回第二步调整</button>
        <div class="action-cluster">
          <p id="scriptHint">确认后生成两个分段故事板。</p>
          <button class="primary-button" id="confirmAndGenerateButton" type="button"
            data-action="confirm-and-generate-visual">确认脚本并生成故事板图片</button>
        </div>
      </div>
      <div class="workflow-panel">
        <div>
          <p class="section-index">MARKET BRIEF</p>
          <h3>${escapeHtml(marketTitle(project))}</h3>
        </div>
        <p>${escapeHtml(project.marketBrief?.coreMessage || "")}</p>
      </div>
      ${renderScriptTimeline(script)}
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
      const nextShot = { ...shot };
      for (const [field] of SHOT_FIELDS) {
        const fieldInput = document.querySelector(
          `[data-segment="${segmentKey}"][data-shot-index="${shotIndex}"][data-shot-field="${field}"]`
        );
        nextShot[field] = clean(fieldInput?.value);
      }
      return nextShot;
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
  const completedItems = completedStoryboardItems(project);
  const entries = storyboardEntries(project);
  const failure = project.visualGenerationFailure;
  const needsRealImages = project.status === "export" && completedItems.length < 2;
  const progress = state.workflowProgress?.active && state.workflowProgress.stage === "visual"
    ? state.workflowProgress
    : null;
  if (progress) {
    container.innerHTML = `
      <div class="section-heading compact-stage-heading">
        <div>
          <p class="section-index">STEP 04</p>
          <h2>正在生成故事板</h2>
          <p>两张图片由后端并发执行。每张都使用已上传商品图进行 img2img，完成项会立即保留。</p>
        </div>
        <span class="requirement" id="visualProgressCount">${completedItems.length}/2</span>
      </div>
      <div class="script-progress active storyboard-progress" id="visualProgress">
        <span><i class="workflow-progress-fill" style="width:${progress.percent}%"></i></span>
        <strong>${progress.percent}%</strong>
        <p class="workflow-progress-message">${escapeHtml(progress.message)}</p>
      </div>
      <div class="storyboard-grid">
        ${["0-10s", "10-20s"].map((segmentId) => renderStoryboardStateCard(project, segmentId, entries.find((item) => item.segment_id === segmentId), true)).join("")}
      </div>
    `;
    return;
  }
  if (failure || needsRealImages || entries.some((item) => item?.status === "failed") || state.visualGenerationError) {
    container.innerHTML = `
      <div class="section-heading">
        <div>
          <p class="section-index">STEP 04</p>
          <h2>故事板生成未完成</h2>
          <p>已完成 ${completedItems.length}/2 张。已成功的图片会保留，继续生成时只处理缺失或已失效的图片。</p>
        </div>
        <span class="requirement">${completedItems.length}/2</span>
      </div>
      <div class="storyboard-grid partial-deliverable-grid">
        ${["0-10s", "10-20s"].map((segmentId) => renderStoryboardStateCard(project, segmentId, entries.find((item) => item.segment_id === segmentId))).join("")}
      </div>
      <div class="visual-error-card">
        <p class="error-message">${escapeHtml(failure?.message || state.visualGenerationError || (needsRealImages
          ? "当前项目还没有两张可交付的真实故事板图片。请确认图片供应商已就绪后继续生成。"
          : "图片生成失败。"))}</p>
        <button class="primary-button" id="generateVisualButton" type="button" data-action="generate-visual">
          继续生成缺失图片
        </button>
      </div>
    `;
    return;
  }
  if (completedItems.length === 2) {
    container.innerHTML = `
      <div class="section-heading compact-stage-heading">
        <div>
          <p class="section-index">STEP 04</p>
          <h2>故事板生成完成</h2>
          <p>两张分段故事板已保存。可预览或下载图片，完整对应脚本保留在导出页。</p>
        </div>
        <span class="requirement">2/2 已完成</span>
      </div>
      <div class="storyboard-grid">
        ${["0-10s", "10-20s"].map((segmentId) => renderStoryboardCard(project, completedItems.find((item) => item.segment_id === segmentId))).join("")}
      </div>
      <div class="stage-actions compact-stage-actions">
        <p>故事板只展示图片与必要信息，避免重复堆叠完整脚本。</p>
        <button class="primary-button" type="button" data-action="view-export">进入最终交付</button>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div class="future-content">
      <p class="section-index">STEP 04</p>
      <h2>故事板图片</h2>
      <p>此步骤生成两个分段故事板，并在这里展示 0/2、1/2、2/2、失败与重试状态。只有两张完成后才能进入最终交付。</p>
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

function selectedStoryboardItems(project) {
  const selectedRatio = project.marketBrief?.outputAspectRatio || "9:16";
  const items = project.imagePackage?.image_generation || [];
  return ["0-10s", "10-20s"]
    .map((segmentId) => [...items].reverse().find((item) =>
      item.segment_id === segmentId &&
      item.type === "storyboard_board" &&
      item.aspect_ratio === selectedRatio
    ))
    .filter(Boolean);
}

function storyboardEntries(project) {
  return selectedStoryboardItems(project);
}

function completedStoryboardItems(project) {
  return storyboardEntries(project).filter((item) => item.status === "done" && item.generated_image?.url);
}

export function hasReadyStoryboards(project = state.project) {
  return completedStoryboardItems(project).length === 2;
}

function renderStoryboardImage(item) {
  if (!item.generated_image?.url) {
    return `<div class="generated-image-preview"><span>分镜 ${escapeHtml(item.aspect_ratio || "")}</span></div>`;
  }
  return `
    <button class="generated-image-preview clickable-preview" type="button"
      data-preview-image="${escapeHtml(item.generated_image.url)}"
      data-preview-title="${escapeHtml(`${item.segment_id} 故事板 · 分镜比例 ${item.aspect_ratio}`)}">
      <img src="${escapeHtml(item.generated_image.url)}" alt="${escapeHtml(item.asset_id)}">
    </button>
  `;
}

function renderStoryboardCard(project, item) {
  if (!item) return "";
  const segment = scriptSegmentById(project, item.segment_id) || {};
  const shotCount = Array.isArray(segment.shots) ? segment.shots.length : 0;
  return `
    <article class="storyboard-card">
      <div class="storyboard-card-heading">
        <div>
          <p class="section-index">${escapeHtml(item.segment_id)}</p>
          <h3>${escapeHtml(segment.theme || `${item.segment_id} 故事板`)}</h3>
        </div>
        <span class="storyboard-status">已保存</span>
      </div>
      ${renderStoryboardImage(item)}
      <div class="storyboard-meta">
        <span>时长 10s</span>
        <span>分镜比例 ${escapeHtml(item.aspect_ratio || "")}</span>
        <span>镜头 ${escapeHtml(shotCount)} 个</span>
      </div>
      ${item.generated_image?.url ? `
        <a class="ghost-button storyboard-download" href="${escapeHtml(item.generated_image.url)}"
          download="${escapeHtml(item.asset_id || `${item.segment_id}-storyboard`)}">下载图片</a>
      ` : ""}
    </article>
  `;
}

function renderStoryboardStateCard(project, segmentId, item, generating = false) {
  if (item?.status === "done" && item.generated_image?.url) return renderStoryboardCard(project, item);
  const segment = scriptSegmentById(project, segmentId) || {};
  const failed = item?.status === "failed";
  return `
    <article class="storyboard-card storyboard-state-card ${failed ? "failed" : "pending"}">
      <div class="storyboard-card-heading">
        <div><p class="section-index">${escapeHtml(segmentId)}</p><h3>${escapeHtml(segment.theme || `${segmentId} 故事板`)}</h3></div>
        <span class="storyboard-status">${failed ? "生成失败" : generating ? "生成中" : "等待生成"}</span>
      </div>
      <div class="storyboard-skeleton ${generating ? "active" : ""}"><i></i><span>${failed ? "该分段尚无图片，重试只会补这一张。" : "正在准备 img2img 故事板画面"}</span></div>
      <div class="storyboard-meta"><span>时长 10s</span><span>分镜比例 ${escapeHtml(project.marketBrief?.outputAspectRatio || "9:16")}</span><span>镜头 ${escapeHtml(segment.shots?.length || 0)} 个</span></div>
      ${failed && item.error?.message ? `<p class="storyboard-item-error">${escapeHtml(item.error.message)}</p>` : ""}
    </article>
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
          <h3>${escapeHtml(item.segment_id)} 故事板</h3>
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

  const imageItems = completedStoryboardItems(project);
  if (imageItems.length !== 2) {
    container.innerHTML = `
      <div class="future-content script-start-panel visual-error-card">
        <p class="section-index">STEP 05</p>
        <h2>最终交付尚未就绪</h2>
        <p>Step 5 只展示完整交付。请回到 Step 4 完成两张真实故事板图片。</p>
        <button class="primary-button" type="button" data-action="view-visual">返回故事板</button>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="section-index">STEP 05</p>
        <h2>最终交付</h2>
        <p>这里只保留你拿去生成视频需要的内容：两张故事板图片，以及各自对应的 10 秒脚本。</p>
      </div>
      <span class="requirement">${escapeHtml(imageItems.length)} 张故事板 · 分镜 ${escapeHtml(project.marketBrief?.outputAspectRatio || imageItems[0]?.aspect_ratio || "")}</span>
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
  const saveState = el("saveState");
  if (saveState) saveState.textContent = value ? busyText : "已保存到本机";
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

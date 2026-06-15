import {
  countryNames,
  el,
  escapeHtml,
  formatTime,
  isSingleVideoProject,
  projectSetup,
  state,
  videoDurationSeconds
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

const SINGLE_SEGMENT_KEY = "segment_full";
const SINGLE_SEGMENT_ID = "full";

const THEME_LABELS = {
  "city-motion": "城市动线",
  "daily-comfort": "全天舒适",
  "performance-detail": "性能细节",
  "street-style": "街头风格"
};

const CHINESE_SCRIPT_COPY = new Map(Object.entries({
  "Immediate low-angle product-first landing with the full shoe identity readable.": "产品从低机位进入画面，完整清晰地展示鞋款识别特征。",
  "Macro pass across the confirmed upper texture, lace layout, and side detail.": "微距扫过已确认的鞋面纹理、鞋带结构与侧面细节。",
  "Short movement sequence with the shoe remaining the clear hero.": "鞋款保持视觉主体，完成一段简短的运动展示。",
  "Side profile detail hold with the confirmed midsole shape readable.": "停留展示侧面轮廓，清楚呈现已确认的中底结构。",
  "Fast full-shoe hero flash that locks the silhouette before the next segment.": "快速闪现完整鞋款画面，在下一段前强化轮廓记忆。",
  "Controlled sole and side-profile proof shot using only visible product details.": "仅使用可见产品细节，展示鞋底与侧面轮廓。",
  "Smooth everyday movement matched to the selected audience and market tone.": "结合目标人群与市场语气，呈现自然流畅的日常运动。",
  "Final clean ecommerce hero with the complete shoe visible.": "完整鞋款进入干净的电商主视觉画面。",
  "Close product proof pass across the outsole and lower side detail.": "近距离扫过外底与鞋身下部细节，验证产品特征。",
  "CTA-ready hero frame with the shoe centered and fully readable.": "鞋款居中完整呈现，形成适合行动号召的收尾画面。",
  "The shoe enters frame and lands cleanly without changing shape or color.": "鞋款干净入场并落地，保持原有鞋型与配色。",
  "A controlled light sweep reveals visible product construction.": "受控光线扫过鞋身，展示可见的产品结构。",
  "One confident step carries the product into motion.": "一个有力步伐带动鞋款进入运动状态。",
  "The shoe pivots slightly to show the side structure.": "鞋款轻微转动，展示侧面结构。",
  "The shoe lands in a stable hero pose for a quick read.": "鞋款稳定落入主视觉姿态，便于快速识别。",
  "The shoe rolls through one stable step with the sole profile readable.": "鞋款完成一个稳定步伐，清楚展示鞋底轮廓。",
  "Two natural steps keep the confirmed colors and silhouette consistent.": "两个自然步伐保持已确认的配色与轮廓一致。",
  "The shoe settles into a simple hero pose and holds.": "鞋款进入简洁主视觉姿态并停留。",
  "A short motion pass keeps the sole and side pattern stable.": "短促运动展示中保持鞋底与侧面图案稳定。",
  "The shoe holds steady with no added logos or invented labels.": "鞋款稳定停留，不增加标志或虚构标签。",
  "Low-angle close-up with a short push-in.": "低机位特写，镜头短距离推进。",
  "Macro side detail.": "侧面细节微距镜头。",
  "Low side tracking shot.": "低机位侧面跟拍。",
  "Clean three-quarter side close-up.": "干净的侧前方三分之二特写。",
  "Full product close-up.": "完整产品特写。",
  "Low three-quarter product angle.": "低机位侧前三分之二产品角度。",
  "Side tracking medium close-up.": "侧面跟拍中近景。",
  "Full product hero close-up.": "完整产品主视觉特写。",
  "Low macro tracking move.": "低机位微距跟拍。",
  "Centered ecommerce hero frame.": "居中的电商主视觉画面。",
  "Distinctive product identity": "突出清晰的产品识别特征",
  "Structured sole profile": "突出有层次的鞋底轮廓",
  "Clear product recognition": "确保产品清楚可识别",
  "Beat hit and short whoosh.": "节拍重音配合短促掠过声。",
  "Soft snap over the beat.": "节拍上叠加轻柔弹响。",
  "Footstep rhythm and music lift.": "脚步节奏推动音乐上扬。",
  "Short camera click and beat lift.": "短促快门声配合节拍提升。",
  "Final hit into proof segment.": "以收束重音进入产品验证段落。",
  "Clean contact sound.": "干净的落地接触声。",
  "Music rises with light footsteps.": "音乐随轻快脚步逐渐上扬。",
  "Final beat and short hold.": "最后一个节拍后短暂停留。",
  "Light scrape and beat tick.": "轻微摩擦声配合节拍点。",
  "Final resolved chord.": "以完整和弦收束。",
  "Fast push-in.": "快速推进。",
  "Match cut.": "匹配剪辑。",
  "Motion cut into proof segment.": "通过运动剪辑进入产品验证段落。",
  "Graphic match cut.": "图形匹配转场。",
  "Hard cut.": "直接切换。",
  "Quick clean cut.": "快速干净切换。",
  "Soft speed ramp.": "柔和变速转场。",
  "End hold.": "结尾停留。",
  "Clean whip cut.": "干净甩镜转场。",
  "พร้อมลุยทุกวัน": "每天都准备好出发",
  "เบา คล่องตัว": "轻盈灵活",
  "มั่นใจทุกก้าว": "每一步都更自信",
  "สบายทุกจังหวะ": "每个节奏都舒适",
  "พร้อมแล้ว ไปกันเลย": "准备好了，现在出发",
  "Siap dipakai setiap hari": "每天都准备好穿上",
  "Ringan saat bergerak": "移动时轻盈自在",
  "Mantap di setiap langkah": "每一步都稳健自信",
  "Nyaman sampai akhir": "舒适坚持到最后",
  "Siap melangkah": "准备迈步出发",
  "Sẵn sàng mỗi ngày": "每天都准备好",
  "Nhẹ nhàng chuyển động": "轻盈自在地移动",
  "Tự tin từng bước": "每一步都更自信",
  "Êm ái đến cuối": "舒适直到最后",
  "Sẵn sàng lên đường": "准备出发",
  "Ready for every day": "每天都准备好",
  "Light on the move": "移动中保持轻盈",
  "Confident every step": "每一步都更自信",
  "Comfort to the finish": "舒适坚持到最后",
  "Ready when you are": "随时准备出发",
  "Sedia untuk setiap hari": "每天都准备好",
  "Ringan bila bergerak": "移动时轻盈自在",
  "Yakin setiap langkah": "每一步都更自信",
  "Selesa hingga akhir": "舒适坚持到最后",
  "Jom melangkah": "一起迈步出发",
  "Everyday ready": "每天都准备好",
  "Light in motion": "运动中保持轻盈",
  "Confidence each step": "每一步都更自信",
  "Ready for the city": "准备进入城市节奏",
  "Ready to move": "准备开始行动"
}));

const CHINESE_FIELD_FALLBACK = {
  visual: "按当前镜头展示鞋款，保持产品外观与参考图一致。",
  action: "按照原始脚本完成产品动作，保持轮廓与配色稳定。",
  camera: "使用清晰的产品镜头展示鞋款结构与细节。",
  selling_point: "突出已确认、可从参考图验证的产品卖点。",
  localized_caption_or_vo: "使用目标市场语言呈现简短口播或字幕。",
  sound: "使用与镜头节奏匹配的简洁音效。",
  transition: "自然衔接至下一个镜头。"
};

function clean(value) {
  return String(value || "").trim();
}

function chineseScriptValue(field, value) {
  const source = clean(value);
  if (!source) return CHINESE_FIELD_FALLBACK[field] || "暂无内容";
  if (/[\u3400-\u9fff]/u.test(source)) return source;
  return CHINESE_SCRIPT_COPY.get(source) || CHINESE_FIELD_FALLBACK[field] || "按原始脚本执行。";
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
  if (segmentId === SINGLE_SEGMENT_ID) {
    return project.planningPackage?.script_video?.segment_full;
  }
  const script = project.planningPackage?.script_20s || {};
  return segmentId === "0-10s"
    ? script.segment_a_0_10s
    : script.segment_b_10_20s;
}

function storyboardSegmentIds(project) {
  return isSingleVideoProject(project) ? [SINGLE_SEGMENT_ID] : ["0-10s", "10-20s"];
}

function targetStoryboardCount(project) {
  return storyboardSegmentIds(project).length;
}

function singleVideoScript(project) {
  return project.planningPackage?.script_video || {};
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
          <textarea hidden aria-hidden="true"
            data-segment="${escapeHtml(segmentKey)}"
            data-shot-index="${shotIndex}"
            data-shot-field="${escapeHtml(field)}">${escapeHtml(shot[field] || "")}</textarea>
          <div class="script-chinese-copy"
            aria-label="${escapeHtml(segmentLabel)} 镜头 ${shotIndex + 1} ${escapeHtml(label)}">
            ${escapeHtml(chineseScriptValue(field, shot[field]))}
          </div>
        </td>
      `).join("")}
    </tr>
  `;
}

function renderSingleScriptTimeline(scriptVideo) {
  const segment = scriptVideo?.segment_full || {};
  const shots = Array.isArray(segment.shots) ? segment.shots : [];
  return `
    <section class="script-timeline-card single-script-timeline">
      <div hidden>
        <input type="hidden" data-segment="${SINGLE_SEGMENT_KEY}" data-field="theme"
          value="${escapeHtml(segment.theme || "")}">
      </div>
      <div class="script-timeline-table-wrap">
        <table class="script-timeline-table">
          <colgroup>
            <col class="timeline-col-time">
            <col class="timeline-col-visual">
            <col class="timeline-col-action">
            <col class="timeline-col-camera">
            <col class="timeline-col-selling">
            <col class="timeline-col-caption">
            <col class="timeline-col-sound">
            <col class="timeline-col-transition">
          </colgroup>
          <thead>
            <tr>
              <th scope="col">时间</th>
              ${SHOT_FIELDS.map(([, label]) => `<th scope="col">${escapeHtml(label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${shots.map((shot, shotIndex) =>
              renderTimelineRow(SINGLE_SEGMENT_KEY, "完整视频", shot, shotIndex, shotIndex)
            ).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderScriptTimeline(script) {
  let timelineIndex = 0;
  return `
    <section class="script-timeline-card">
      <div hidden>
        ${SEGMENTS.map(([segmentKey]) => {
          const segment = script[segmentKey] || {};
          return `
            <input type="hidden" data-segment="${escapeHtml(segmentKey)}"
              data-field="theme"
              value="${escapeHtml(segment.theme || "")}">
          `;
        }).join("")}
      </div>
      <div class="script-timeline-table-wrap">
        <table class="script-timeline-table">
          <colgroup>
            <col class="timeline-col-time">
            <col class="timeline-col-visual">
            <col class="timeline-col-action">
            <col class="timeline-col-camera">
            <col class="timeline-col-selling">
            <col class="timeline-col-caption">
            <col class="timeline-col-sound">
            <col class="timeline-col-transition">
          </colgroup>
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
  const setup = projectSetup(project);
  const singleVideo = isSingleVideoProject(project);
  return `
    <div class="future-content script-start-panel">
      <p class="section-index">STEP 03</p>
      <h2>市场创意已确认</h2>
      <p>${singleVideo
        ? `将生成一条完整 ${escapeHtml(setup.videoDurationSeconds)} 秒广告脚本，共 ${escapeHtml(setup.shotsPerSegment)} 个镜头。`
        : `将使用第二步选择的每段 ${escapeHtml(setup.shotsPerSegment)} 个镜头生成 20 秒脚本。后续会按两个 10 秒段落分别生成故事板。`}</p>
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
        <button class="primary-button" id="generateScriptButton" type="button" data-action="generate-script">生成脚本</button>
      </div>
    </div>
  `;
}

function renderScriptEditor(project) {
  const planning = project.planningPackage || {};
  const singleVideo = isSingleVideoProject(project);
  const script = planning.script_20s || {};
  const scriptVideo = singleVideoScript(project);
  const duration = scriptVideo.total_duration_sec || videoDurationSeconds(project);
  return `
    <div class="section-heading">
      <div>
        <p class="section-index">STEP 03</p>
        <h2>${singleVideo ? `${escapeHtml(duration)} 秒广告脚本` : "审核 20 秒中文脚本"}</h2>
        <p>${singleVideo
          ? "这里显示完整中文审核稿；确认后使用原始目标语言生成一张故事板和一个视频。"
          : "这里显示中文审核稿；确认后仍使用原始目标语言生成两张故事板与两段交付脚本。"}</p>
      </div>
      <span class="requirement">${singleVideo ? `${escapeHtml(duration)} 秒` : "20 秒"}</span>
    </div>
    <form id="scriptForm" novalidate>
      <div class="script-action-bar">
        <button class="ghost-button" type="button" data-action="edit-market">返回第二步调整</button>
        <div class="action-cluster">
          <p id="scriptHint">${singleVideo ? "确认后生成一张完整故事板。" : "确认后生成两个分段故事板。"}</p>
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
      ${singleVideo ? renderSingleScriptTimeline(scriptVideo) : renderScriptTimeline(script)}
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
  if (isSingleVideoProject(project)) {
    const scriptVideo = planning.script_video || {};
    const segment = scriptVideo.segment_full;
    if (!segment) return planning;
    const themeInput = document.querySelector(`[data-segment="${SINGLE_SEGMENT_KEY}"][data-field="theme"]`);
    segment.theme = clean(themeInput?.value);
    segment.shots = (segment.shots || []).map((shot, shotIndex) => {
      const nextShot = { ...shot };
      for (const [field] of SHOT_FIELDS) {
        const fieldInput = document.querySelector(
          `[data-segment="${SINGLE_SEGMENT_KEY}"][data-shot-index="${shotIndex}"][data-shot-field="${field}"]`
        );
        nextShot[field] = clean(fieldInput?.value);
      }
      return nextShot;
    });
    return planning;
  }
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
  if (planning?.workflow_mode === "single_video" || planning?.script_video?.segment_full) {
    const segment = planning?.script_video?.segment_full;
    const duration = Number(planning?.script_video?.total_duration_sec || segment?.duration_sec || 10);
    if (!clean(segment?.theme)) return "请填写完整视频脚本主题。";
    const shots = Array.isArray(segment?.shots) ? segment.shots : [];
    if (!shots.length) return "完整视频脚本至少需要一个镜头。";
    let cursor = 0;
    for (const [shotIndex, shot] of shots.entries()) {
      if (Number(shot.start_sec) !== cursor) return `镜头 ${shotIndex + 1} 的开始时间需要从 ${cursor}s 接上。`;
      if (Number(shot.end_sec) <= Number(shot.start_sec)) return `镜头 ${shotIndex + 1} 的结束时间必须晚于开始时间。`;
      cursor = Number(shot.end_sec);
      for (const [field, label] of SHOT_FIELDS) {
        if (!clean(shot[field])) return `请填写镜头 ${shotIndex + 1} 的${label}。`;
      }
    }
    if (cursor !== duration) return `脚本时间线需要完整覆盖 0-${duration}s。`;
    return "";
  }
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
  const segmentIds = storyboardSegmentIds(project);
  const total = targetStoryboardCount(project);
  const singleVideo = isSingleVideoProject(project);
  const failure = project.visualGenerationFailure;
  const needsRealImages = project.status === "export" && completedItems.length < total;
  const progress = state.workflowProgress?.active && state.workflowProgress.stage === "visual"
    ? state.workflowProgress
    : null;
  if (progress) {
    container.innerHTML = `
      <div class="section-heading compact-stage-heading">
        <div>
          <p class="section-index">STEP 04</p>
          <h2>正在生成故事板</h2>
          <p>${singleVideo ? "正在生成一张完整故事板，使用已上传商品图进行 img2img。" : "两张图片由后端并发执行。每张都使用已上传商品图进行 img2img，完成项会立即保留。"}</p>
        </div>
        <span class="requirement" id="visualProgressCount">${completedItems.length}/${total}</span>
      </div>
      <div class="script-progress active storyboard-progress" id="visualProgress">
        <span><i class="workflow-progress-fill" style="width:${progress.percent}%"></i></span>
        <strong>${progress.percent}%</strong>
        <p class="workflow-progress-message">${escapeHtml(progress.message)}</p>
      </div>
      <div class="storyboard-grid">
        ${segmentIds.map((segmentId) => renderStoryboardStateCard(project, segmentId, entries.find((item) => item.segment_id === segmentId), true)).join("")}
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
          <p>已完成 ${completedItems.length}/${total} 张。已成功的图片会保留，继续生成时只处理缺失或已失效的图片。</p>
        </div>
        <span class="requirement">${completedItems.length}/${total}</span>
      </div>
      <div class="storyboard-grid partial-deliverable-grid">
        ${segmentIds.map((segmentId) => renderStoryboardStateCard(project, segmentId, entries.find((item) => item.segment_id === segmentId))).join("")}
      </div>
      <div class="visual-error-card">
        <p class="error-message">${escapeHtml(failure?.message || state.visualGenerationError || (needsRealImages
          ? singleVideo
            ? "当前项目还没有可交付的真实故事板图片。请确认图片供应商已就绪后继续生成。"
            : "当前项目还没有两张可交付的真实故事板图片。请确认图片供应商已就绪后继续生成。"
          : "图片生成失败。"))}</p>
        <button class="primary-button" id="generateVisualButton" type="button" data-action="generate-visual">
          ${singleVideo ? "重新生成故事板" : "继续生成缺失图片"}
        </button>
      </div>
    `;
    return;
  }
  if (completedItems.length === total) {
    container.innerHTML = `
      <div class="section-heading compact-stage-heading">
        <div>
          <p class="section-index">STEP 04</p>
          <h2>故事板生成完成</h2>
          <p>${singleVideo ? "完整故事板已保存。下一步使用这张故事板生成最终广告视频。" : "两张分段故事板已保存。可预览或下载图片，完整对应脚本保留在导出页。"}</p>
        </div>
        <span class="requirement">${total}/${total} 已完成</span>
      </div>
      <div class="storyboard-grid">
        ${segmentIds.map((segmentId) => renderStoryboardCard(project, completedItems.find((item) => item.segment_id === segmentId))).join("")}
      </div>
      <div class="stage-actions compact-stage-actions">
        <p>${singleVideo ? "故事板、脚本和视频时长已准备好。" : "故事板只展示图片与必要信息，避免重复堆叠完整脚本。"}</p>
        <button class="primary-button" type="button" data-action="view-export">${singleVideo ? "进入生成视频" : "进入最终交付"}</button>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div class="future-content">
      <p class="section-index">STEP 04</p>
      <h2>故事板图片</h2>
      <p>${singleVideo ? "此步骤生成一张完整故事板，并作为最终视频生成参考。" : "此步骤生成两个分段故事板，并在这里展示 0/2、1/2、2/2、失败与重试状态。只有两张完成后才能进入最终交付。"}</p>
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
  return storyboardSegmentIds(project)
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
  return completedStoryboardItems(project).length === targetStoryboardCount(project);
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
  const duration = item.duration_sec || segment.duration_sec || (item.segment_id === SINGLE_SEGMENT_ID ? videoDurationSeconds(project) : 10);
  return `
    <article class="storyboard-card">
      <div class="storyboard-card-heading">
        <div>
          <p class="section-index">${escapeHtml(item.segment_id === SINGLE_SEGMENT_ID ? "完整视频" : item.segment_id)}</p>
          <h3>${escapeHtml(segment.theme || (item.segment_id === SINGLE_SEGMENT_ID ? "完整视频故事板" : `${item.segment_id} 故事板`))}</h3>
        </div>
        <span class="storyboard-status">已保存</span>
      </div>
      ${renderStoryboardImage(item)}
      <div class="storyboard-meta">
        <span>时长 ${escapeHtml(duration)}s</span>
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
  const duration = item?.duration_sec || segment.duration_sec || (segmentId === SINGLE_SEGMENT_ID ? videoDurationSeconds(project) : 10);
  return `
    <article class="storyboard-card storyboard-state-card ${failed ? "failed" : "pending"}">
      <div class="storyboard-card-heading">
        <div><p class="section-index">${escapeHtml(segmentId === SINGLE_SEGMENT_ID ? "完整视频" : segmentId)}</p><h3>${escapeHtml(segment.theme || (segmentId === SINGLE_SEGMENT_ID ? "完整视频故事板" : `${segmentId} 故事板`))}</h3></div>
        <span class="storyboard-status">${failed ? "生成失败" : generating ? "生成中" : "等待生成"}</span>
      </div>
      <div class="storyboard-skeleton ${generating ? "active" : ""}"><i></i><span>${failed ? "该故事板尚无图片，重试只会补这一张。" : "正在准备 img2img 故事板画面"}</span></div>
      <div class="storyboard-meta"><span>时长 ${escapeHtml(duration)}s</span><span>分镜比例 ${escapeHtml(project.marketBrief?.outputAspectRatio || "9:16")}</span><span>镜头 ${escapeHtml(segment.shots?.length || 0)} 个</span></div>
      ${failed && item.error?.message ? `<p class="storyboard-item-error">${escapeHtml(item.error.message)}</p>` : ""}
    </article>
  `;
}

function videoStatusLabel(status) {
  return {
    waiting: "等待生成",
    submitting: "正在提交任务",
    queued: "排队中",
    generating: "生成中",
    downloading: "正在取回视频",
    done: "生成完成",
    failed: "生成失败"
  }[status] || "等待生成";
}

function isVideoInFlight(status) {
  return ["submitting", "queued", "generating", "downloading"].includes(status);
}

function currentVideoTask(project) {
  const workflow = project?.videoPackage?.workflow_mode || project?.workflowMode || (isSingleVideoProject(project) ? "single_video" : "legacy_multi_segment");
  const items = project?.videoPackage?.video_generation || [];
  if (workflow === "single_video") {
    return items.find((item) => item.segment_id === SINGLE_SEGMENT_ID) || null;
  }
  return items.find((item) => item.segment_id === "0-10s") || items[0] || null;
}

function videoTaskForSegment(project, segmentId) {
  return (project?.videoPackage?.video_generation || []).find((item) => item.segment_id === segmentId) || null;
}

function videoSummary(project) {
  const setup = projectSetup(project);
  const item = currentVideoTask(project);
  const storyboard = storyboardEntries(project).find((entry) => entry.segment_id === (isSingleVideoProject(project) ? SINGLE_SEGMENT_ID : (item?.segment_id || "0-10s")));
  return {
    duration: isSingleVideoProject(project) ? setup.videoDurationSeconds : 10,
    storyboard,
    item,
    status: item?.status || "waiting"
  };
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

function renderVideoTaskCard(project, storyboard, index) {
  const item = videoTaskForSegment(project, storyboard.segment_id);
  const segment = scriptSegmentById(project, storyboard.segment_id) || {};
  const status = item?.status || "waiting";
  const videoUrl = item?.generated_video?.url || "";
  const duration = item?.duration_sec || storyboard.duration_sec || segment.duration_sec || 10;
  const scriptText = item?.script_copy || segmentCopy(segment);
  return `
    <article class="video-workflow-card video-segment-task" data-status="${escapeHtml(status)}">
      <div class="storyboard-card-heading">
        <div>
          <p class="section-index">${escapeHtml(storyboard.segment_id)}</p>
          <h3>${escapeHtml(storyboard.segment_id)} 视频任务</h3>
        </div>
        <span class="storyboard-status">${escapeHtml(videoStatusLabel(status))}</span>
      </div>
      <div class="video-workflow-summary">
        <div>
          <span>故事板输入</span>
          <strong>${escapeHtml(storyboard.segment_id)}</strong>
        </div>
        <div>
          <span>视频时长</span>
          <strong>${escapeHtml(duration)} 秒</strong>
        </div>
        <div>
          <span>输出比例</span>
          <strong>${escapeHtml(project.marketBrief?.outputAspectRatio || storyboard.aspect_ratio || "")}</strong>
        </div>
        <div>
          <span>任务状态</span>
          <strong>${escapeHtml(videoStatusLabel(status))}</strong>
        </div>
      </div>
      <div class="video-workflow-main">
        <article class="video-preview-card">
          ${storyboard.generated_image?.url ? `
            <img src="${escapeHtml(storyboard.generated_image.url)}" alt="${escapeHtml(storyboard.segment_id)} 故事板">
          ` : `<div class="video-preview-placeholder">尚无故事板</div>`}
        </article>
        <div class="video-copy-card">
          <strong>对应脚本</strong>
          <pre id="segmentVideoScript${index}">${escapeHtml(scriptText)}</pre>
          <button class="ghost-button small" type="button" data-copy-target="segmentVideoScript${index}">复制脚本</button>
          <p class="video-task-note">${escapeHtml(item?.error?.message || "完成后可播放和下载这一段视频。")}</p>
        </div>
      </div>
      <div class="video-workflow-actions">
        ${status === "done" && videoUrl ? `
          <video controls playsinline src="${escapeHtml(videoUrl)}"></video>
          <a class="primary-button" href="${escapeHtml(videoUrl)}" download>下载视频</a>
        ` : isVideoInFlight(status) ? `
          <button class="primary-button" type="button" data-action="refresh-video" ${state.busy ? "disabled" : ""}>刷新视频状态</button>
        ` : status === "failed" ? `
          <button class="primary-button" type="button" data-action="retry-video"
            data-video-segment="${escapeHtml(storyboard.segment_id)}" ${state.busy ? "disabled" : ""}>重新生成这一段</button>
        ` : `
          <button class="primary-button" type="button" data-action="generate-video" ${state.busy ? "disabled" : ""}>开始生成视频</button>
        `}
        ${status === "failed" ? `<button class="ghost-button" type="button" data-action="refresh-video" ${state.busy ? "disabled" : ""}>刷新状态</button>` : ""}
      </div>
    </article>
  `;
}

export function renderExportStage(project = state.project) {
  const container = el("exportStageContent");
  if (!container || !project) return;

  const singleVideo = isSingleVideoProject(project);
  const summary = videoSummary(project);
  const imageItems = completedStoryboardItems(project);
  if (singleVideo) {
    const item = summary.item;
    const storyboard = summary.storyboard;
    const storyboardTitle = storyboard?.segment_id === SINGLE_SEGMENT_ID ? "完整视频故事板" : "故事板";
    if (!storyboard) {
      container.innerHTML = `
        <div class="future-content script-start-panel visual-error-card">
          <p class="section-index">STEP 05</p>
          <h2>生成视频尚未就绪</h2>
          <p>请先完成 Step 04 的一张完整故事板。</p>
          <button class="primary-button" type="button" data-action="view-visual">返回故事板</button>
        </div>
      `;
      return;
    }
    const videoUrl = item?.generated_video?.url || "";
    const script = project.planningPackage?.script_video?.segment_full || {};
    const status = item?.status || "waiting";
    container.innerHTML = `
      <div class="section-heading">
        <div>
          <p class="section-index">STEP 05</p>
          <h2>生成视频</h2>
          <p>这里只展示一个视频任务。视频时长、脚本和故事板都跟随 Step 02 选择的时长。</p>
        </div>
        <span class="requirement">${escapeHtml(summary.duration)} 秒 · ${videoStatusLabel(status)}</span>
      </div>
      <div class="video-workflow-card" data-status="${escapeHtml(status)}">
        <div class="video-workflow-summary">
          <div>
            <span>视频时长</span>
            <strong>${escapeHtml(summary.duration)} 秒</strong>
          </div>
          <div>
            <span>输出比例</span>
            <strong>${escapeHtml(project.marketBrief?.outputAspectRatio || storyboard.aspect_ratio || "")}</strong>
          </div>
          <div>
            <span>镜头数量</span>
            <strong>${escapeHtml(Array.isArray(script.shots) ? script.shots.length : 0)} 个</strong>
          </div>
          <div>
            <span>任务状态</span>
            <strong>${escapeHtml(videoStatusLabel(status))}</strong>
          </div>
        </div>
        <div class="video-workflow-main">
          <article class="video-preview-card">
            ${storyboard.generated_image?.url ? `
              <img src="${escapeHtml(storyboard.generated_image.url)}" alt="${escapeHtml(storyboardTitle)}">
            ` : `<div class="video-preview-placeholder">尚无故事板</div>`}
          </article>
          <div class="video-copy-card">
            <strong>脚本摘要</strong>
            <p>${escapeHtml((script.shots || []).map((shot, index) =>
              `${shot.start_sec}-${shot.end_sec}s 镜头 ${index + 1}`
            ).slice(0, 4).join("；") || "脚本已生成。")}</p>
            <p class="video-task-note">${escapeHtml(item?.error?.message || project.videoGenerationFailure?.message || "视频生成完成后可播放和下载。")}</p>
          </div>
        </div>
        <div class="video-workflow-actions">
          ${status === "done" && videoUrl ? `
            <video controls playsinline src="${escapeHtml(videoUrl)}"></video>
            <a class="primary-button" href="${escapeHtml(videoUrl)}" download>下载视频</a>
          ` : isVideoInFlight(status) ? `
            <button class="primary-button" type="button" data-action="refresh-video" ${state.busy ? "disabled" : ""}>刷新视频状态</button>
          ` : status === "failed" ? `
            <button class="primary-button" type="button" data-action="retry-video" ${state.busy ? "disabled" : ""}>重新生成视频</button>
          ` : `
            <button class="primary-button" type="button" data-action="generate-video" ${state.busy ? "disabled" : ""}>开始生成视频</button>
          `}
          ${status === "failed" ? `<button class="ghost-button" type="button" data-action="refresh-video" ${state.busy ? "disabled" : ""}>刷新状态</button>` : ""}
        </div>
      </div>
    `;
    return;
  }

  if (imageItems.length !== 2) {
    container.innerHTML = `
      <div class="future-content script-start-panel visual-error-card">
        <p class="section-index">STEP 05</p>
        <h2>生成视频尚未就绪</h2>
        <p>Step 5 只展示完整交付。请回到 Step 4 完成两张真实故事板图片。</p>
        <button class="primary-button" type="button" data-action="view-visual">返回故事板</button>
      </div>
    `;
    return;
  }
  const videoItems = project.videoPackage?.video_generation || [];
  const completedVideos = videoItems.filter((item) => item.status === "done" && item.generated_video?.url).length;
  container.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="section-index">STEP 05</p>
        <h2>生成视频</h2>
        <p>双段模式使用两张故事板作为输入，生成两个 10 秒视频任务；已完成的视频会保留，失败段可单独重试。</p>
      </div>
      <span class="requirement">${escapeHtml(completedVideos)}/2 视频 · ${escapeHtml(imageItems.length)}/2 故事板</span>
    </div>
    <div class="video-task-grid">
      ${imageItems.map((item, index) => renderVideoTaskCard(project, item, index)).join("")}
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

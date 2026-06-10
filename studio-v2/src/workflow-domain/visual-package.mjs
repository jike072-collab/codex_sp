import { DomainError } from "./domain-error.mjs";
import { assertProjectStage, transitionProject } from "./project-workflow.mjs";

const QC_CHECKLIST = Object.freeze([
  "Each storyboard covers only its own 10-second segment.",
  "Storyboard sheet is a delivery board, not a cropped video frame.",
  "Each internal shot panel follows the selected output aspect ratio.",
  "Shoe colors, silhouette, midsole, and outsole stay consistent.",
  "No fake logo or changed side pattern is introduced.",
  "Each storyboard includes shot timing, picture, sound, voiceover, and subtitle notes."
]);

const STORYBOARD_SHEET = Object.freeze({
  layout: "storyboard_sheet",
  aspect_ratio: "3:2",
  default_size: "1536x1024"
});

function productRules(lock) {
  const mustKeep = (lock.must_keep || []).map((item) => `KEEP: ${item}`).join(" | ");
  const mustNotChange = (lock.must_not_change || [])
    .map((item) => `DO NOT CHANGE: ${item}`)
    .join(" | ");
  return `${mustKeep} | ${mustNotChange}`.trim();
}

function shotLine(shot, index) {
  return [
    `Shot ${index + 1}: ${shot.start_sec}-${shot.end_sec}s`,
    `Picture: ${shot.visual}`,
    `Action: ${shot.action}`,
    `Camera: ${shot.camera}`,
    `Selling point: ${shot.selling_point}`,
    `Voiceover/subtitle: ${shot.localized_caption_or_vo}`,
    `Sound: ${shot.sound}`,
    `Transition: ${shot.transition}`
  ].join(" | ");
}

function scriptCopy(segment) {
  return [
    `${segment.segment_id}｜${segment.theme}`,
    ...segment.shots.map((shot, index) => [
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

function storyboardPrompt({ project, segment, frameAspectRatio, rules }) {
  const lock = project.planningPackage.product_lock_manifest || {};
  const colors = [
    ...(lock.main_colors || []),
    ...(lock.supporting_colors || [])
  ].filter(Boolean).join(", ");
  const memory = [
    project.marketBrief?.coreMessage,
    ...(lock.must_keep || []).slice(0, 3)
  ].filter(Boolean).join(" | ");
  const shotRows = segment.shots.map(shotLine).join("\n");

  return [
    `Create one landscape commercial storyboard sheet for ONLY the ${segment.segment_id} shoe ad segment.`,
    "The overall canvas is a storyboard delivery sheet, not a cropped video frame.",
    `Every internal shot thumbnail/panel must be composed as a ${frameAspectRatio} video frame, matching the selected Step 02 output ratio.`,
    "Do not make the whole storyboard sheet 9:16, 16:9, 4:5, or any other selected video ratio; apply that ratio only inside each shot panel.",
    "Do not include scenes from the other 10-second segment.",
    "Visual layout reference: clean Chinese commercial storyboard sheet, bold black title, white background, thin grey table lines, numbered shot blocks, product reference strip, and structured rows similar to a desktop-shooting storyboard.",
    "Required board sections:",
    `1) Header: ${project.name} | ${segment.segment_id} storyboard | shot panel ratio ${frameAspectRatio}.`,
    `2) Product lock zone: shoe type, colors (${colors || "confirmed colors"}), material, sole, must-keep and must-not-change notes.`,
    `3) Shot table: one block per shot; each picture panel uses ${frameAspectRatio} composition with timing, picture, action, camera, selling point, sound, voiceover, subtitle, and transition.`,
    "4) Final memory strip: large keywords for the audience to remember.",
    "5) Small color palette and production notes area.",
    `Confirmed segment script rows:\n${shotRows}`,
    `Final memory keywords: ${memory || "clear shoe identity | comfort | movement"}.`,
    `Product identity rules: ${rules}`,
    "Use generated storyboard thumbnails inside each shot block, plus concise readable labels. Keep all text short, high-contrast, and arranged like a practical production board.",
    "The shoe reference must remain accurate; do not invent a new shoe, logo, outsole, or colorway."
  ].join("\n");
}

function storyboardAsset(project, segment, frameAspectRatio, rules) {
  return {
    asset_id: `${segment.segment_id}_storyboard_board`,
    segment_id: segment.segment_id,
    type: "storyboard_board",
    aspect_ratio: frameAspectRatio,
    storyboard_sheet: { ...STORYBOARD_SHEET },
    prompt: storyboardPrompt({ project, segment, frameAspectRatio, rules }),
    negative_prompt: "wrong shoe, changed color, fake logo, distorted sole, unreadable layout, missing shots, includes other time segment, keyframe-only image, single hero photo",
    reference_policy: "Use all uploaded shoe product views as strict product identity references.",
    script_copy: scriptCopy(segment)
  };
}

export function generateVisualPackage(project, generatedAt = new Date().toISOString()) {
  if (!["visual", "export"].includes(project.status)) {
    assertProjectStage(project, "visual", "生成故事版图片");
  }
  if (!project.planningPackage || !project.scriptConfirmedAt) {
    throw new DomainError("请先确认广告脚本，再生成故事版图片。", {
      code: "SCRIPT_CONFIRMATION_REQUIRED"
    });
  }

  const planning = project.planningPackage;
  const rules = productRules(planning.product_lock_manifest || {});
  const frameAspectRatio = project.marketBrief?.outputAspectRatio || "9:16";
  const segmentA = planning.script_20s.segment_a_0_10s;
  const segmentB = planning.script_20s.segment_b_10_20s;
  const imageGeneration = [
    storyboardAsset(project, segmentA, frameAspectRatio, rules),
    storyboardAsset(project, segmentB, frameAspectRatio, rules)
  ];

  project.imagePackage = {
    mode: "demo",
    storyboard_plan: {
      total_images: 2,
      selected_aspect_ratio: frameAspectRatio,
      selected_frame_aspect_ratio: frameAspectRatio,
      storyboard_sheet: { ...STORYBOARD_SHEET },
      segments: imageGeneration.map((item) => ({
        segment_id: item.segment_id,
        storyboard_goal: `One storyboard sheet for ${item.segment_id}; internal shot panels use ${frameAspectRatio}.`
      }))
    },
    image_generation: imageGeneration,
    qc_checklist: [...QC_CHECKLIST]
  };
  project.manualOmniPackages = [];
  project.visualGeneratedAt = generatedAt;
  project.visualGenerationFailure = null;
  if (project.status === "visual") {
    transitionProject(project, "export");
  } else {
    project.status = "export";
  }
  return project;
}

export function recordVisualGenerationFailure(project, error, failedAt = new Date().toISOString()) {
  project.status = "visual";
  project.visualGeneratedAt = null;
  project.visualGenerationFailure = {
    code: error?.code || "IMAGE_PROVIDER_ERROR",
    message: error?.message || "故事板图片生成失败。",
    failedAt,
    possiblyBilled: Boolean(error?.possiblyBilled)
  };
  if (Number.isInteger(error?.providerStatus)) {
    project.visualGenerationFailure.providerStatus = error.providerStatus;
  }
  return project;
}

import { DomainError } from "./domain-error.mjs";
import { assertProjectStage, transitionProject } from "./project-workflow.mjs";

const QC_CHECKLIST = Object.freeze([
  "Shoe colors stay consistent with confirmed references.",
  "Shoe silhouette, midsole, and outsole structure stay consistent.",
  "No fake logo or changed side pattern is introduced.",
  "Storyboard and keyframe prompts match their confirmed 10-second script.",
  "Localized captions remain short and are added in post-production."
]);

function productRules(lock) {
  const mustKeep = (lock.must_keep || []).map((item) => `KEEP: ${item}`).join(" | ");
  const mustNotChange = (lock.must_not_change || [])
    .map((item) => `DO NOT CHANGE: ${item}`)
    .join(" | ");
  return `${mustKeep} | ${mustNotChange}`;
}

function asset(asset_id, segment_id, type, aspect_ratio, prompt, negative_prompt) {
  return {
    asset_id,
    segment_id,
    type,
    aspect_ratio,
    prompt,
    negative_prompt,
    reference_policy: "Use all uploaded shoe product views as strict product identity references."
  };
}

function omniPackage(segment, rules) {
  const isFirst = segment.segment_id === "0-10s";
  return {
    segment_id: segment.segment_id,
    upload_references: [
      `${segment.segment_id} confirmed script`,
      `${segment.segment_id}_storyboard_board prompt or generated image`,
      `${segment.segment_id}_video_keyframe prompt or generated image`,
      "shoe product reference images"
    ],
    script: structuredClone(segment),
    flow_omni_prompt: [
      `Generate a 10-second 9:16 ecommerce shoe video for segment ${segment.segment_id}.`,
      isFirst
        ? "Use a strong product-first hook, then establish product identity and movement."
        : "Show visible product proof, controlled movement, and finish on a clear full-shoe hero frame.",
      `Follow the confirmed shot order and timing exactly. ${rules}`,
      "Do not generate readable captions inside the video frames; localized captions will be added in post-production."
    ].join(" "),
    caption_note: "Add localized captions in post-production, not inside generated video frames."
  };
}

export function generateVisualPackage(project, generatedAt = new Date().toISOString()) {
  assertProjectStage(project, "visual", "生成视觉提示词");
  if (!project.planningPackage || !project.scriptConfirmedAt) {
    throw new DomainError("请先确认广告脚本，再生成视觉提示词。", {
      code: "SCRIPT_CONFIRMATION_REQUIRED"
    });
  }

  const planning = project.planningPackage;
  const lock = planning.product_lock_manifest;
  const rules = productRules(lock);
  const segmentA = planning.script_20s.segment_a_0_10s;
  const segmentB = planning.script_20s.segment_b_10_20s;

  const imageGeneration = [
    asset(
      "0-10s_storyboard_board",
      "0-10s",
      "storyboard_board",
      "16:9",
      `Create a 16:9 commercial storyboard production board for the confirmed 0-10s script. Show shot timing, action, camera, selling point, caption note, and sound note for every shot. ${rules}`,
      "wrong shoe, changed color, fake logo, distorted sole, missing shots, unreadable layout"
    ),
    asset(
      "0-10s_video_keyframe",
      "0-10s",
      "video_keyframe",
      "9:16",
      `Create a clean 9:16 cinematic keyframe for the confirmed 0-10s product-first hook. No table, poster typography, or captions. Keep the shoe as the clear hero. ${rules}`,
      "text, captions, tables, poster layout, wrong shoe, changed color, fake logo"
    ),
    asset(
      "10-20s_storyboard_board",
      "10-20s",
      "storyboard_board",
      "16:9",
      `Create a 16:9 commercial storyboard production board for the confirmed 10-20s proof and hero-close script. Show shot timing, action, camera, selling point, caption note, sound note, and the final full-shoe frame. ${rules}`,
      "wrong shoe, changed color, fake logo, distorted sole, missing final hero, unreadable layout"
    ),
    asset(
      "10-20s_video_keyframe",
      "10-20s",
      "video_keyframe",
      "9:16",
      `Create a clean 9:16 cinematic keyframe for the confirmed 10-20s proof and final hero moment. Show the complete shoe clearly with no captions or poster typography. ${rules}`,
      "text, captions, tables, poster layout, cropped shoe, changed color, fake logo"
    )
  ];

  project.imagePackage = {
    mode: "demo",
    storyboard_plan: {
      total_images: 4,
      segments: [
        {
          segment_id: "0-10s",
          storyboard_goal: "Product-first hook, identity, and first movement.",
          keyframe_goal: "Clean vertical product-first hook frame."
        },
        {
          segment_id: "10-20s",
          storyboard_goal: "Visible product proof and clear ecommerce close.",
          keyframe_goal: "Clean vertical final proof and full-shoe hero frame."
        }
      ]
    },
    image_generation: imageGeneration,
    qc_checklist: [...QC_CHECKLIST]
  };
  project.manualOmniPackages = [
    omniPackage(segmentA, rules),
    omniPackage(segmentB, rules)
  ];
  project.visualGeneratedAt = generatedAt;
  transitionProject(project, "export");
  return project;
}


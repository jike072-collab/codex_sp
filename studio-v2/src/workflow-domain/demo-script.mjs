import { DomainError } from "./domain-error.mjs";
import { assertProjectStage } from "./project-workflow.mjs";
import {
  isSingleVideoMode,
  selectedVideoDurationSeconds
} from "./workflow-mode.mjs";

const LOCALES = Object.freeze({
  Thailand: {
    language: "Thai",
    subtitle_style: "Short, friendly Thai ecommerce captions.",
    voiceover_style: "Energetic, natural, and informal.",
    cta_style: "Short Thai shopping CTA.",
    captions: ["พร้อมลุยทุกวัน", "เบา คล่องตัว", "มั่นใจทุกก้าว", "สบายทุกจังหวะ"],
    cta: "พร้อมแล้ว ไปกันเลย"
  },
  Indonesia: {
    language: "Bahasa Indonesia",
    subtitle_style: "Short, direct Indonesian ecommerce captions.",
    voiceover_style: "Friendly, energetic, and conversational.",
    cta_style: "Simple Indonesian shopping CTA.",
    captions: ["Siap dipakai setiap hari", "Ringan saat bergerak", "Mantap di setiap langkah", "Nyaman sampai akhir"],
    cta: "Siap melangkah"
  },
  Vietnam: {
    language: "Vietnamese",
    subtitle_style: "Short Vietnamese captions with direct product benefits.",
    voiceover_style: "Young, energetic, and natural.",
    cta_style: "Short Vietnamese shopping CTA.",
    captions: ["Sẵn sàng mỗi ngày", "Nhẹ nhàng chuyển động", "Tự tin từng bước", "Êm ái đến cuối"],
    cta: "Sẵn sàng lên đường"
  },
  Philippines: {
    language: "English with Tagalog-friendly phrasing",
    subtitle_style: "Simple English captions with a casual local shopping tone.",
    voiceover_style: "Warm, upbeat, and conversational.",
    cta_style: "Short English shopping CTA.",
    captions: ["Ready for every day", "Light on the move", "Confident every step", "Comfort to the finish"],
    cta: "Ready when you are"
  },
  Malaysia: {
    language: "Bahasa Malaysia",
    subtitle_style: "Short Bahasa Malaysia ecommerce captions.",
    voiceover_style: "Casual, confident, and energetic.",
    cta_style: "Short Bahasa Malaysia shopping CTA.",
    captions: ["Sedia untuk setiap hari", "Ringan bila bergerak", "Yakin setiap langkah", "Selesa hingga akhir"],
    cta: "Jom melangkah"
  },
  Singapore: {
    language: "English",
    subtitle_style: "Clean, short, direct English captions.",
    voiceover_style: "Modern, concise, and urban.",
    cta_style: "Direct English shopping CTA.",
    captions: ["Everyday ready", "Light in motion", "Confidence each step", "Comfort to the finish"],
    cta: "Ready for the city"
  }
});

const THEME_LABELS = Object.freeze({
  "city-motion": "City Motion",
  "daily-comfort": "Daily Comfort",
  "performance-detail": "Performance Detail",
  "street-style": "Street Style"
});

function localeFor(country) {
  return LOCALES[country] || {
    language: `Local language of ${country}`,
    subtitle_style: "Short local ecommerce captions.",
    voiceover_style: "Natural, energetic, and conversational.",
    cta_style: "Short local shopping CTA.",
    captions: ["Everyday ready", "Light in motion", "Confidence each step", "Comfort to the finish"],
    cta: "Ready to move"
  };
}

function sellingPointsFromAnalysis(analysis) {
  const candidates = Array.isArray(analysis.visible_selling_point_candidates)
    ? analysis.visible_selling_point_candidates
    : [];
  const safeCandidates = candidates
    .filter((item) => item && typeof item.feature === "string" && item.feature.trim())
    .slice(0, 3)
    .map((item) => ({
      point: item.feature.trim(),
      evidence: item.evidence || "visible",
      visual_proof: item.visual_proof || "Visible in the confirmed product references.",
      ad_expression: item.safe_claim_boundary || "Show the visible product detail without technical claims."
    }));

  if (safeCandidates.length) return safeCandidates;

  return [
    {
      point: "Distinctive product identity",
      evidence: "visible",
      visual_proof: "The confirmed colors, silhouette, and side details are visible in the references.",
      ad_expression: "Keep the shoe clearly recognizable in every shot."
    },
    {
      point: "Structured sole profile",
      evidence: "visible",
      visual_proof: "The confirmed midsole and outsole shapes are visible in the references.",
      ad_expression: "Use close product angles without making technical performance claims."
    }
  ];
}

function shot(start_sec, end_sec, values) {
  return {
    start_sec,
    end_sec,
    visual: values.visual,
    action: values.action,
    camera: values.camera,
    selling_point: values.selling_point,
    localized_caption_or_vo: values.localized_caption_or_vo,
    sound: values.sound,
    transition: values.transition
  };
}

function normalizeShotCount(value) {
  const count = Number(value);
  return [3, 4, 5].includes(count) ? count : 5;
}

function fitTemplatesToCount(templates, count) {
  if (!templates.length) return [];
  if (count <= templates.length) return count === templates.length
    ? templates
    : [...templates.slice(0, Math.max(1, count - 1)), templates.at(-1)];
  throw new Error(`Need ${count} distinct shot templates, but only ${templates.length} are defined.`);
}

function timedShots(start, end, templates, count) {
  const selectedCount = Math.max(1, Number(count) || 0);
  const duration = (end - start) / selectedCount;
  const selectedTemplates = fitTemplatesToCount(templates, selectedCount);
  return selectedTemplates.map((values, index) => {
    const shotStart = Number((start + duration * index).toFixed(2));
    const shotEnd = Number((index === selectedCount - 1 ? end : start + duration * (index + 1)).toFixed(2));
    return shot(shotStart, shotEnd, values);
  });
}

function autoShotCountForDuration(duration) {
  const normalized = Number(duration);
  if (!Number.isFinite(normalized) || normalized <= 0) return 3;
  return Math.max(3, Math.min(8, Math.ceil(normalized / 2)));
}

function buildLegacyPlanningPackage(project, locale, theme, captions, lock, sellingPoints, shotsPerSegment) {
  const segmentATemplates = [
    {
      visual: "Immediate low-angle product-first landing with the full shoe identity readable.",
      action: "The shoe enters frame and lands cleanly without changing shape or color.",
      camera: "Low-angle close-up with a short push-in.",
      selling_point: sellingPoints[0].point,
      localized_caption_or_vo: captions[0],
      sound: "Beat hit and short whoosh.",
      transition: "Fast push-in."
    },
    {
      visual: "Macro pass across the confirmed upper texture, lace layout, and side detail.",
      action: "A controlled light sweep reveals visible product construction.",
      camera: "Macro side detail.",
      selling_point: sellingPoints[0].point,
      localized_caption_or_vo: captions[1],
      sound: "Soft snap over the beat.",
      transition: "Match cut."
    },
    {
      visual: "Short movement sequence with the shoe remaining the clear hero.",
      action: "One confident step carries the product into motion.",
      camera: "Low side tracking shot.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[2],
      sound: "Footstep rhythm and music lift.",
      transition: "Motion cut into proof segment."
    },
    {
      visual: "Side profile detail hold with the confirmed midsole shape readable.",
      action: "The shoe pivots slightly to show the side structure.",
      camera: "Clean three-quarter side close-up.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[2],
      sound: "Short camera click and beat lift.",
      transition: "Graphic match cut."
    },
    {
      visual: "Fast full-shoe hero flash that locks the silhouette before the next segment.",
      action: "The shoe lands in a stable hero pose for a quick read.",
      camera: "Full product close-up.",
      selling_point: "Clear product recognition",
      localized_caption_or_vo: captions[0],
      sound: "Final hit into proof segment.",
      transition: "Hard cut."
    }
  ];
  const segmentBTemplates = [
    {
      visual: "Controlled sole and side-profile proof shot using only visible product details.",
      action: "The shoe rolls through one stable step with the sole profile readable.",
      camera: "Low three-quarter product angle.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[2],
      sound: "Clean contact sound.",
      transition: "Quick clean cut."
    },
    {
      visual: "Smooth everyday movement matched to the selected audience and market tone.",
      action: "Two natural steps keep the confirmed colors and silhouette consistent.",
      camera: "Side tracking medium close-up.",
      selling_point: project.marketBrief.coreMessage,
      localized_caption_or_vo: captions[3],
      sound: "Music rises with light footsteps.",
      transition: "Soft speed ramp."
    },
    {
      visual: "Final clean ecommerce hero with the complete shoe visible.",
      action: "The shoe settles into a simple hero pose and holds.",
      camera: "Full product hero close-up.",
      selling_point: "Clear product recognition",
      localized_caption_or_vo: locale.cta,
      sound: "Final beat and short hold.",
      transition: "End hold."
    },
    {
      visual: "Close product proof pass across the outsole and lower side detail.",
      action: "A short motion pass keeps the sole and side pattern stable.",
      camera: "Low macro tracking move.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[1],
      sound: "Light scrape and beat tick.",
      transition: "Clean whip cut."
    },
    {
      visual: "CTA-ready hero frame with the shoe centered and fully readable.",
      action: "The shoe holds steady with no added logos or invented labels.",
      camera: "Centered ecommerce hero frame.",
      selling_point: project.marketBrief.coreMessage,
      localized_caption_or_vo: locale.cta,
      sound: "Final resolved chord.",
      transition: "End hold."
    }
  ];

  return {
    mode: "demo",
    workflow_mode: "legacy_multi_segment",
    locale_profile: {
      target_country: project.marketBrief.targetCountry,
      language: locale.language,
      subtitle_style: locale.subtitle_style,
      voiceover_style: locale.voiceover_style,
      cta_style: locale.cta_style
    },
    product_lock_manifest: lock,
    selling_points: sellingPoints,
    creative_direction: {
      video_positioning: `20-second local ecommerce shoe ad for ${project.marketBrief.audience}`,
      core_emotion: [project.marketBrief.tone, "ready", "confident"],
      visual_style: [theme, "clean product hero", "fast ecommerce cuts"],
      recommended_theme: project.marketBrief.creativeTheme,
      theme_reason: project.marketBrief.coreMessage
    },
    script_20s: {
      total_duration_sec: 20,
      segment_a_0_10s: {
        segment_id: "0-10s",
        theme: "Hook and product identity",
        duration_sec: 10,
        shots: timedShots(0, 10, segmentATemplates, shotsPerSegment)
      },
      segment_b_10_20s: {
        segment_id: "10-20s",
        theme: "Proof and product close",
        duration_sec: 10,
        shots: timedShots(10, 20, segmentBTemplates, shotsPerSegment)
      }
    },
    localized_copy: {
      caption_lines: [...captions, locale.cta],
      cta_options: [locale.cta],
      do_not_use: [
        "Unverified technical performance claims",
        "Invented brand names or logos",
        "Long text rendered inside generated video frames"
      ]
    },
    confirmation_summary: {
      what_to_confirm: [
        "Shot timing and continuity",
        "Localized captions and CTA",
        "Product identity rules",
        "Market message and audience fit"
      ],
      risk_notes: [
        "Demo mode creates deterministic creative copy and does not verify real performance claims."
      ]
    }
  };
}

function buildSingleVideoPlanningPackage(project, locale, theme, captions, lock, sellingPoints) {
  const duration = selectedVideoDurationSeconds(project);
  const shotCount = autoShotCountForDuration(duration);
  const templates = [
    {
      visual: "Immediate product-first hero landing with the full shoe identity readable.",
      action: "The shoe enters frame and settles into a confident hold.",
      camera: "Low-angle close-up with a short push-in.",
      selling_point: sellingPoints[0].point,
      localized_caption_or_vo: captions[0],
      sound: "Beat hit and short whoosh.",
      transition: "Fast push-in."
    },
    {
      visual: "Macro pass across the confirmed upper texture, lace layout, and side detail.",
      action: "A controlled light sweep reveals visible product construction.",
      camera: "Macro side detail.",
      selling_point: sellingPoints[0].point,
      localized_caption_or_vo: captions[1],
      sound: "Soft snap over the beat.",
      transition: "Match cut."
    },
    {
      visual: "Movement sequence with the shoe remaining the clear hero.",
      action: "One confident step carries the product into motion.",
      camera: "Low side tracking shot.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[2],
      sound: "Footstep rhythm and music lift.",
      transition: "Motion cut."
    },
    {
      visual: "Side profile detail hold with the confirmed midsole shape readable.",
      action: "The shoe pivots slightly to show the side structure.",
      camera: "Clean three-quarter side close-up.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[2],
      sound: "Short camera click and beat lift.",
      transition: "Graphic match cut."
    },
    {
      visual: "Top-down composition reveals the confirmed lace path and toe shape against a clean surface.",
      action: "The shoe slides into a precise top-view mark and pauses for inspection.",
      camera: "Locked overhead frame with a gentle rack focus.",
      selling_point: sellingPoints[0].point,
      localized_caption_or_vo: captions[1],
      sound: "Soft slide and focus click.",
      transition: "Shape match."
    },
    {
      visual: "Low rear three-quarter view shows the confirmed heel structure during a natural step.",
      action: "The heel settles and lifts once while all product details remain stable.",
      camera: "Rear low-angle tracking close-up.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[3],
      sound: "Measured footfall over a rising beat.",
      transition: "Rhythmic cut."
    },
    {
      visual: "Clean outsole reveal isolates the visible tread pattern without adding technical claims.",
      action: "The shoe rolls upward briefly, then returns to its natural profile.",
      camera: "Bottom-detail tilt with a controlled pull-back.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[2],
      sound: "Short textured sweep.",
      transition: "Snap back to hero."
    },
    {
      visual: "Final clean ecommerce hero with the complete shoe visible.",
      action: "The shoe settles into a simple hero pose and holds.",
      camera: "Centered ecommerce hero frame.",
      selling_point: "Clear product recognition",
      localized_caption_or_vo: locale.cta,
      sound: "Final beat and short hold.",
      transition: "End hold."
    }
  ];

  return {
    mode: "demo",
    workflow_mode: "single_video",
    locale_profile: {
      target_country: project.marketBrief.targetCountry,
      language: locale.language,
      subtitle_style: locale.subtitle_style,
      voiceover_style: locale.voiceover_style,
      cta_style: locale.cta_style
    },
    product_lock_manifest: lock,
    selling_points: sellingPoints,
    creative_direction: {
      video_positioning: `${duration}-second local ecommerce shoe ad for ${project.marketBrief.audience}`,
      core_emotion: [project.marketBrief.tone, "ready", "confident"],
      visual_style: [theme, "clean product hero", "fast ecommerce cuts"],
      recommended_theme: project.marketBrief.creativeTheme,
      theme_reason: project.marketBrief.coreMessage
    },
    script_video: {
      total_duration_sec: duration,
      segment_full: {
        segment_id: "full",
        theme: "Single video hero story",
        duration_sec: duration,
        shots: timedShots(0, duration, templates, shotCount)
      }
    },
    localized_copy: {
      caption_lines: [...captions, locale.cta],
      cta_options: [locale.cta],
      do_not_use: [
        "Unverified technical performance claims",
        "Invented brand names or logos",
        "Long text rendered inside generated video frames"
      ]
    },
    confirmation_summary: {
      what_to_confirm: [
        "Shot timing and continuity",
        "Localized captions and CTA",
        "Product identity rules",
        "Market message and audience fit"
      ],
      risk_notes: [
        "Demo mode creates deterministic creative copy and does not verify real performance claims."
      ]
    }
  };
}

export function generateDemoPlanningPackage(project, options = {}) {
  assertProjectStage(project, "script", "生成广告脚本");
  if (!project.visionAnalysis || !project.reviewConfirmedAt) {
    throw new DomainError("请先确认产品锁定，再生成广告脚本。", {
      code: "PRODUCT_REVIEW_REQUIRED"
    });
  }
  if (!project.marketBrief || !project.marketConfirmedAt) {
    throw new DomainError("请先确认市场创意，再生成广告脚本。", {
      code: "MARKET_BRIEF_REQUIRED"
    });
  }

  const locale = localeFor(project.marketBrief.targetCountry);
  const theme = THEME_LABELS[project.marketBrief.creativeTheme]
    || project.marketBrief.creativeTheme;
  const captions = locale.captions;
  const lock = structuredClone(project.visionAnalysis.product_lock_manifest);
  const sellingPoints = sellingPointsFromAnalysis(project.visionAnalysis);
  const shotsPerSegment = normalizeShotCount(options.shotsPerSegment);
  if (isSingleVideoMode(project)) {
    return buildSingleVideoPlanningPackage(project, locale, theme, captions, lock, sellingPoints);
  }
  return buildLegacyPlanningPackage(project, locale, theme, captions, lock, sellingPoints, shotsPerSegment);
  const segmentATemplates = [
    {
      visual: "Immediate low-angle product-first landing with the full shoe identity readable.",
      action: "The shoe enters frame and lands cleanly without changing shape or color.",
      camera: "Low-angle close-up with a short push-in.",
      selling_point: sellingPoints[0].point,
      localized_caption_or_vo: captions[0],
      sound: "Beat hit and short whoosh.",
      transition: "Fast push-in."
    },
    {
      visual: "Macro pass across the confirmed upper texture, lace layout, and side detail.",
      action: "A controlled light sweep reveals visible product construction.",
      camera: "Macro side detail.",
      selling_point: sellingPoints[0].point,
      localized_caption_or_vo: captions[1],
      sound: "Soft snap over the beat.",
      transition: "Match cut."
    },
    {
      visual: "Short movement sequence with the shoe remaining the clear hero.",
      action: "One confident step carries the product into motion.",
      camera: "Low side tracking shot.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[2],
      sound: "Footstep rhythm and music lift.",
      transition: "Motion cut into proof segment."
    },
    {
      visual: "Side profile detail hold with the confirmed midsole shape readable.",
      action: "The shoe pivots slightly to show the side structure.",
      camera: "Clean three-quarter side close-up.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[2],
      sound: "Short camera click and beat lift.",
      transition: "Graphic match cut."
    },
    {
      visual: "Fast full-shoe hero flash that locks the silhouette before the next segment.",
      action: "The shoe lands in a stable hero pose for a quick read.",
      camera: "Full product close-up.",
      selling_point: "Clear product recognition",
      localized_caption_or_vo: captions[0],
      sound: "Final hit into proof segment.",
      transition: "Hard cut."
    }
  ];
  const segmentBTemplates = [
    {
      visual: "Controlled sole and side-profile proof shot using only visible product details.",
      action: "The shoe rolls through one stable step with the sole profile readable.",
      camera: "Low three-quarter product angle.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[2],
      sound: "Clean contact sound.",
      transition: "Quick clean cut."
    },
    {
      visual: "Smooth everyday movement matched to the selected audience and market tone.",
      action: "Two natural steps keep the confirmed colors and silhouette consistent.",
      camera: "Side tracking medium close-up.",
      selling_point: project.marketBrief.coreMessage,
      localized_caption_or_vo: captions[3],
      sound: "Music rises with light footsteps.",
      transition: "Soft speed ramp."
    },
    {
      visual: "Final clean ecommerce hero with the complete shoe visible.",
      action: "The shoe settles into a simple hero pose and holds.",
      camera: "Full product hero close-up.",
      selling_point: "Clear product recognition",
      localized_caption_or_vo: locale.cta,
      sound: "Final beat and short hold.",
      transition: "End hold."
    },
    {
      visual: "Close product proof pass across the outsole and lower side detail.",
      action: "A short motion pass keeps the sole and side pattern stable.",
      camera: "Low macro tracking move.",
      selling_point: sellingPoints.at(-1).point,
      localized_caption_or_vo: captions[1],
      sound: "Light scrape and beat tick.",
      transition: "Clean whip cut."
    },
    {
      visual: "CTA-ready hero frame with the shoe centered and fully readable.",
      action: "The shoe holds steady with no added logos or invented labels.",
      camera: "Centered ecommerce hero frame.",
      selling_point: project.marketBrief.coreMessage,
      localized_caption_or_vo: locale.cta,
      sound: "Final resolved chord.",
      transition: "End hold."
    }
  ];

  return {
    mode: "demo",
    locale_profile: {
      target_country: project.marketBrief.targetCountry,
      language: locale.language,
      subtitle_style: locale.subtitle_style,
      voiceover_style: locale.voiceover_style,
      cta_style: locale.cta_style
    },
    product_lock_manifest: lock,
    selling_points: sellingPoints,
    creative_direction: {
      video_positioning: `20-second local ecommerce shoe ad for ${project.marketBrief.audience}`,
      core_emotion: [project.marketBrief.tone, "ready", "confident"],
      visual_style: [theme, "clean product hero", "fast ecommerce cuts"],
      recommended_theme: project.marketBrief.creativeTheme,
      theme_reason: project.marketBrief.coreMessage
    },
    script_20s: {
      total_duration_sec: 20,
      segment_a_0_10s: {
        segment_id: "0-10s",
        theme: "Hook and product identity",
        duration_sec: 10,
        shots: timedShots(0, 10, segmentATemplates, shotsPerSegment)
      },
      segment_b_10_20s: {
        segment_id: "10-20s",
        theme: "Proof and product close",
        duration_sec: 10,
        shots: timedShots(10, 20, segmentBTemplates, shotsPerSegment)
      }
    },
    localized_copy: {
      caption_lines: [...captions, locale.cta],
      cta_options: [locale.cta],
      do_not_use: [
        "Unverified technical performance claims",
        "Invented brand names or logos",
        "Long text rendered inside generated video frames"
      ]
    },
    confirmation_summary: {
      what_to_confirm: [
        "Shot timing and continuity",
        "Localized captions and CTA",
        "Product identity rules",
        "Market message and audience fit"
      ],
      risk_notes: [
        "Demo mode creates deterministic creative copy and does not verify real performance claims."
      ]
    }
  };
}

export function generateProjectDemoScript(project, generatedAt = new Date().toISOString(), options = {}) {
  return applyGeneratedPlanningPackage(
    project,
    generateDemoPlanningPackage(project, options),
    generatedAt
  );
}

export function applyGeneratedPlanningPackage(project, planningPackage, generatedAt) {
  project.planningPackage = planningPackage;
  if (planningPackage?.workflow_mode) {
    project.workflowMode = planningPackage.workflow_mode;
  }
  project.scriptGeneratedAt = generatedAt;
  project.scriptConfirmedAt = null;
  project.imagePackage = null;
  project.manualOmniPackages = [];
  project.visualGeneratedAt = null;
  return project;
}

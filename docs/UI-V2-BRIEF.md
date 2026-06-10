# UI V2 Brief

This is the source of truth for the second visual version of Shoe Ad Studio.
The user supplied:

- `C:/Users/Administrator/Desktop/91fd278a-ac1e-46d4-b622-013494be30ac.png`
- `C:/Users/Administrator/Downloads/Shoe_Ad_Studio_工作台_UI动画_前后端任务拆分文档_clean.docx`

The PNG is an AI-generated visual reference. Borrow the strong visual ideas,
but do not copy it literally and do not add fake shoe assets. The DOCX file did
not expose extractable text in the local reader, so this brief fills the missing
implementation detail from the image, current app behavior, and the user's
direction.

## Product Goal

Create a polished `ui-v2` version of the existing local studio. The workflow and
APIs stay the same; the main change is perceived quality:

- Cleaner hierarchy.
- More premium visual rhythm.
- Softer motion and click feedback.
- Better upload, status, progress, and final-delivery presentation.
- One consistent visual language across all steps.

## Visual Direction

Use the reference image as inspiration for these patterns:

- Dark left rail with subtle green glow, compact project cards, and a strong
  neon-lime create button.
- Large airy white workspace with soft radial highlights and card shadows.
- Horizontal five-step progress header with numbered circles, arrows, active
  underline, short title, and subtitle.
- Main stage card plus a right-side quality/status panel.
- Upload stage hero with a large drop zone, soft green glow, and clear primary
  action.
- Reference-angle cards below upload: numbered badge, thumbnail, label, short
  helper text, and completion check.
- Local save state shown as a quiet pill in the upper right.
- Rounded cards, thin borders, glassy surfaces, restrained highlights.

Do not use heavy shadows everywhere. The design should feel precise and calm,
not noisy.

## Motion Direction

Use CSS transitions and small vanilla JavaScript helpers only unless Codex A
explicitly approves a dependency. Preferred motion:

- Hover lift on cards and buttons.
- Press scale on primary buttons.
- Smooth active-step underline.
- Drag-over glow on upload area.
- Lightweight progress ring/bar animation.
- Toast slide/fade.
- Dialog fade/scale.
- Respect `prefers-reduced-motion`.

Avoid long looping decorative animations that distract from workflow tasks.

## Current Workflow To Preserve

The UI must keep the current V1 behavior:

1. Create local project.
2. Upload product images.
3. Analyze product.
4. Confirm product lock and creative settings.
5. Generate/edit two 10-second script blocks.
6. Generate two storyboard images concurrently with img2img only.
7. Final delivery shows exactly two storyboard images and two matching scripts.

Do not reintroduce JSON delivery, Flow Omni packages, prompt-only image
generation, or the old single `rightCodesApiKey`.

## UI V2 Page Requirements

### Global Shell

- Sidebar width can grow from the current 260px if needed, but keep content
  compact and avoid horizontal scrolling.
- Header should include project label, project name, status pill, saved-local
  pill, and settings button.
- Stepper should show five visible steps:
  `商品素材 -> 产品设定 -> 生成脚本 -> 故事板 -> 导出`.
- The hidden market step remains an internal state; do not expose it as a
  separate visual step unless Codex A changes the workflow contract.

### Step 01 Upload

- Make upload the first polished showcase.
- Add six suggested angle cards:
  `主视图`, `侧视图`, `后跟视图`, `鞋底视图`, `细节特写`, `穿着场景`.
- These are guidance cards, not required upload slots.
- Show upload count/readiness in the right panel.
- Keep existing upload and delete behavior.

### Step 02 Product Settings

- Keep the compact popover controls from V1, but restyle them to match UI V2.
- Keep one-line promise below all buttons.
- Product-lock details remain optional/collapsible.

### Step 03 Script

- Keep two 10-second script columns where space allows.
- Top actions remain sticky and clear.
- Progress should look like UI V2, not a basic browser bar.

### Step 04 Storyboard

- Communicate img2img-only generation.
- Show partial success clearly: `0/2`, `1/2`, or `2/2`.
- Do not hide successfully stored local images if the other image fails.

### Step 05 Export

- Final page shows only:
  - two storyboard images
  - two matching scripts
  - copy controls
- No JSON package button.

## Accessibility And Responsiveness

- Keyboard focus states must remain visible.
- Do not remove form labels or ARIA labels.
- Support at least 1280px desktop width cleanly.
- At narrow widths, stack the right panel below the main card.
- Respect `prefers-reduced-motion`.

## Non-Goals

- No account system.
- No cloud sync.
- No new AI provider.
- No paid API call during tests.
- No real model call from frontend code.
- No backend schema change unless Codex A approves it.

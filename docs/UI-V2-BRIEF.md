# UI V2 Brief

This is the source of truth for the second visual version of Shoe Ad Studio.
The user supplied:

- `C:/Users/Administrator/Desktop/91fd278a-ac1e-46d4-b622-013494be30ac.png`
- `C:/Users/Administrator/Downloads/Shoe_Ad_Studio_工作台_UI动画_前后端任务拆分文档_clean.docx`
- `C:/Users/Administrator/Downloads/ChatGPT Image 2026年6月10日 14_40_49 (1).png`
- `C:/Users/Administrator/Downloads/ChatGPT Image 2026年6月10日 14_40_50 (2).png`
- `C:/Users/Administrator/Downloads/ChatGPT Image 2026年6月10日 14_40_51 (3).png`
- `C:/Users/Administrator/Downloads/ChatGPT Image 2026年6月10日 14_40_52 (4).png`
- `C:/Users/Administrator/Downloads/ChatGPT Image 2026年6月10日 14_40_53 (5).png`

The PNG is an AI-generated visual reference. Borrow the strong visual ideas,
but do not copy it literally and do not add fake shoe assets. The DOCX body was
not extractable through the local OOXML reader, but the user supplied readable
page screenshots. The requirements below incorporate those pages together with
the current app behavior and the user's latest product decisions.

When the document conflicts with the working application, current product
decisions win. In particular, UI V2 must not require a React/Next.js rewrite,
must not restore JSON/ZIP delivery, and must not add prompt-only image
generation.

The five `ChatGPT Image ...` files are newer AI beautification references. They
are useful for layout, card hierarchy, sidebar treatment, right-inspector
structure, and interaction affordances. They are not data/content references:
do not copy their fake storyboard shoe images, fake file exports, or any UI
content that conflicts with the current workflow.

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

## New AI Beautification References

Borrow these visual ideas from the five newer images:

- Keep the dark left sidebar consistently premium: stronger logo mark, large
  lime create button, compact project cards, selected-state glow, local/API
  status at the bottom, and no horizontal scrollbar.
- Use the top workspace pattern from the references: project label/name/status
  on the left, saved-local state and project settings on the right, and the
  five-step progress rail below.
- Use a two-column desktop layout across steps: wide main task card on the left
  and a narrower right inspector for quality, checklist, tips, and progress.
- Use large rounded white cards with thin soft borders, quiet dividers, and
  lime only for the active step, primary action, checks, and progress rings.
- Step action buttons should feel like the references: secondary outline button
  paired with a bright lime primary button, aligned at the bottom or sticky top
  when the page is tall.
- Right inspector panels should show a clear numeric/ring status when useful,
  followed by short checklist rows and one compact tips card.

Do not copy these unsuitable parts:

- The storyboard images in the references are placeholders and are visually
  inconsistent with our actual generated outputs. Use real generated local
  storyboard images only.
- The export reference showing ZIP, CSV, "export all files", or file packages
  conflicts with the current requirement. UI V2 export/delivery must remain two
  storyboard images plus two scripts/copy controls only.
- Do not add fake shoe thumbnails or fake upload assets. Guidance cards can use
  neutral placeholders or existing uploaded images only.
- Do not add features that are only present in the mockups but absent from the
  product contract, such as cloud sync, account state, or unrelated file
  download formats.

## Design Tokens

Use these document-derived values as the starting palette, adjusting contrast
only when accessibility requires it:

- App background: `#F7F8F1`.
- Card surface: `#FFFFFF`.
- Sidebar: `#080D0C` to `#0D1110`.
- Accent: neon lime around `#CFFF24`.
- Primary text: `#101410`.
- Muted text: `#667064`.
- Soft border: `#E1E7D8`.
- Success: `#1E7A3A`.

Use one radius scale, one shadow scale, and shared spacing variables throughout
the application. The lime accent is for primary actions, active progress,
success emphasis, and focus states; it should not fill every surface.

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
Prefer `transform` and `opacity` for motion. Most interaction transitions should
finish in `0.25s` to `0.45s`. Popovers may use a short `scale(0.98) -> 1` and
fade; progress and loading states should remain informative rather than
decorative.

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
- Sidebar should contain the logo, create-project action, compact local project
  list, local/API state, and a restrained assistant/status card.
- Header should include project label, project name, status pill, saved-local
  pill, and settings button.
- Stepper should show five visible steps:
  `商品素材 -> 产品设定 -> 生成脚本 -> 故事板 -> 导出`.
- On wide screens, the main workspace should use roughly `70-75%` width and the
  inspector/status panel `25-30%`.
- Keep the main action bar visible near the top or sticky within the current
  step; users should not need to scroll to find confirm/back/generate actions.
- The hidden market step remains an internal state; do not expose it as a
  separate visual step unless Codex A changes the workflow contract.

### Step 01 Upload

- Make upload the first polished showcase.
- The upload page may follow the newer reference with a large centered upload
  zone, illustrated neutral upload icon/glow, one primary upload button, and a
  right inspector with readiness percentage/checklist.
- Add six suggested angle cards:
  `主视图`, `侧视图`, `后跟视图`, `鞋底视图`, `细节特写`, `穿着场景`.
- These are guidance cards, not required upload slots.
- Angle cards should be compact and image-led where an uploaded image is
  available; otherwise use neutral placeholders, not fake product images.
- Show upload count/readiness and an AI quality score/checklist in the right
  panel. Derive it from existing local data; do not invent a paid analysis call.
- Keep existing upload and delete behavior.
- Upload motion should include a drag-over highlight, stable thumbnail entrance,
  and clear delete feedback without layout jumping.

### Step 02 Product Settings

- Keep the compact popover controls from V1, but restyle them to match UI V2.
- Follow the new settings reference for the main layout: six compact setting
  cards in the main card, each with a simple icon, label, current value, and
  chevron.
- Country, audience, size, theme, tone, and shot count should appear together in
  one compact settings region rather than separate drawers.
- Clicking a setting should open its control immediately; it must not require a
  second click to enter edit mode.
- Keep one-line promise below all buttons.
- The one-line promise placeholder should explain that leaving it blank lets the
  system fill it automatically.
- Product-lock details remain optional/collapsible.
- Confirmation must fit in the viewport, remain Chinese-first, and place confirm
  and back actions at the top.

### Step 03 Script

- Keep two 10-second script columns where space allows.
- The newer script reference can be used for density: each `0-10s` and `10-20s`
  block should show a compact row/grid of shot cards so the user can understand
  the full sequence without excessive scrolling.
- Top actions remain sticky and clear.
- Progress should look like UI V2, not a basic browser bar.
- The selected shot count controls how many shots are generated in each
  10-second block.
- Each shot should present image, action, camera, selling point, voice/subtitle,
  sound, and transition together in one compact card.
- Support focused editing and regeneration without losing the other completed
  script block.

### Step 04 Storyboard

- Communicate img2img-only generation.
- The newer storyboard reference can be used for layout only: two large result
  cards side by side, each labeled `0-10s` or `10-20s`, with matching title,
  short description, metadata chips, and edit/retry controls.
- Show partial success clearly: `0/2`, `1/2`, or `2/2`.
- Do not hide successfully stored local images if the other image fails.
- Use skeleton/shimmer loading rather than a large blocking spinner.
- Show each `0-10s` and `10-20s` result independently with retry only for the
  missing or failed result.
- Reveal completed images with a short fade/scale transition and keep their
  matching script visible nearby.

### Step 05 Export

- Final page shows only:
  - two storyboard images
  - two matching scripts
  - copy controls
- No JSON package button.
- The export reference can inspire the right-side completion checklist and
  progress ring, but not its file list. Do not add ZIP, CSV, Markdown package,
  "export all files", or unrelated download rows.

## Shared Components And States

Unify the existing controls rather than introducing visually unrelated widgets:

- Button, card, input, textarea, select, popover, dialog, tabs, progress, toast,
  badge, separator, and scroll area.
- Project states: asset uploading, asset ready, analyzing, locked, script
  generating, script ready, storyboard generating, partial storyboard success,
  storyboard ready, export ready, and error.
- Every asynchronous state must show progress or status text and preserve
  completed user work.
- Empty, loading, success, partial success, and error states must use the same
  typography, spacing, icon weight, and action hierarchy.

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
- No framework migration solely for visual polish.
- No JSON, Markdown bundle, or ZIP export restoration.

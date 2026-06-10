# Codex B Frontend Follow-up: Dense No-scroll UI V2

Status: READY

Route: complex

Base: latest remote `v2` at task start

Branch: `codex/frontend-ui-v2-density`

## User Problem

The current UI V2 still wastes too much vertical space. On Step 01, roughly the
top third of the page is header/stepper/status before the useful upload area,
so the user must scroll to reach the content. The goal is a denser workspace
where each major step is visible at a glance on a normal desktop screen.

Reference images are committed in:

- `docs/reference/ui-v2-followup/current-step01-too-tall.png`
- `docs/reference/ui-v2-followup/target-step01-upload.png`
- `docs/reference/ui-v2-followup/target-step02-settings.png`
- `docs/reference/ui-v2-followup/target-step03-script.png`
- `docs/reference/ui-v2-followup/target-step04-storyboard.png`
- `docs/reference/ui-v2-followup/target-step05-export.png`

The target images are visual references only. Do not copy fake shoe/storyboard
images or add fake data.

## Ownership

Allowed to edit:

- `studio-v2/public/**`

Do not edit:

- `studio-v2/src/**`
- `studio-v2/server.mjs`
- `schemas/**`
- `prompts/**`
- `docs/contracts/**`
- root coordination docs
- runtime data, uploads, generated files, logs, PID files, `.env`, or API keys

## Layout Goals

- Compress the top project header and stepper so they no longer consume the top
  third of the page.
- The project name does not need large visual prominence. Keep it small or
  compact in the header/sidebar so it does not push useful content down.
- Make all five steps feel like the reference images: main usable content should
  start high and fill the available page.
- Prefer one-screen layouts at desktop sizes. Target `1440x900` and `1920x1080`
  with minimal or no vertical scrolling for normal states.
- Keep the left sidebar compact and avoid horizontal scrolling.
- Keep Chinese-first labels.

## Step-specific Requirements

### Step 01 Upload

Use `target-step01-upload.png` as the layout direction:

- Large but not overly tall upload area.
- Suggested angle cards should sit in the same visible page, not far below.
- Uploaded image thumbnails should be visible without excessive scrolling.
- Right inspector should remain useful but compact.

### Step 02 Product Settings

Use `target-step02-settings.png` as the layout direction:

- Setting cards should include small icons before labels.
- The six settings should fit together in one compact region.
- One-line promise stays below the setting cards.
- Avoid drawers and avoid requiring a second click to edit.

### Step 03 Script

Use `target-step03-script.png` as the layout direction:

- The two 10-second segments and their shot cards should be readable at a
  glance.
- Reduce excess vertical padding and oversized empty areas.
- Keep selected shot count behavior intact.

### Step 04 Storyboard

Use `target-step04-storyboard.png` as layout inspiration only:

- Show only the two storyboard images in this step, side by side when possible.
- Do not show the full corresponding script under storyboard images.
- Each storyboard card may have compact metadata and actions:
  regenerate, download, edit.
- Preserve partial success display and retry behavior.
- Do not use the fake storyboard images from the mockup.

### Step 05 Export

Use `target-step05-export.png` as layout inspiration, but preserve the product
contract:

- Final delivery remains exactly two storyboard images and two scripts/copy
  controls.
- It may present "可复制内容" and "可导出文件" sections if they map to the existing
  two scripts and two images.
- Do not add JSON, ZIP, CSV, Markdown package, or "export all files".

## Acceptance Checks

Run:

```powershell
node --check .\studio-v2\public\js\*.js
git diff --check
```

Browser smoke checks:

- Step 01 at `1440x900`: useful upload area and angle cards are visible without
  scrolling past a huge header.
- Step 02 at `1440x900`: six icon setting cards and one-line promise are visible.
- Step 03 at `1440x900`: both 10-second script blocks are understandable without
  heavy scrolling.
- Step 04 at `1440x900`: two storyboard cards are visible; no full script block
  appears under them.
- Step 05 at `1440x900`: final copy/export content is compact and does not
  reintroduce forbidden JSON/ZIP/CSV controls.

Report:

- branch
- commit hash
- changed files
- checks run
- screenshots reviewed at `1440x900` and `1920x1080`
- any remaining reason a step still scrolls

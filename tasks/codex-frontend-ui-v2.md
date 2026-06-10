# Codex B UI V2 Frontend Task

Status: READY

Route: complex

Base: latest remote `ui-v2` branch at task start

Branch: `codex/frontend-ui-v2`

## Goal

Create the `ui-v2` visual version of the existing local studio. This is mainly
an appearance, motion, and interaction-quality pass. Preserve the current
workflow and API contracts.

Primary reference:

- `docs/UI-V2-BRIEF.md`
- User-supplied image:
  `C:/Users/Administrator/Desktop/91fd278a-ac1e-46d4-b622-013494be30ac.png`

The image is an AI-generated inspiration, not a pixel-perfect spec.

## Ownership

Allowed to edit:

- `studio-v2/public/**`

Do not edit:

- `studio-v2/src/**`
- `studio-v2/server.mjs`
- `schemas/**`
- `prompts/**`
- `docs/contracts/**`
- root collaboration documents
- runtime data, uploads, generated files, logs, PID files, `.env`, or API keys

## Required Behavior To Preserve

- Project creation, upload, delete, and batch delete.
- Product analysis and confirmation.
- Compact Step 02 popover controls.
- One-line promise remains below all Step 02 buttons and may be left blank.
- Script generation and editing with two 10-second blocks.
- Storyboard generation remains backend-only and img2img-only.
- Final delivery shows exactly two storyboard images and two scripts.
- No JSON delivery button.
- No prompt-only image-generation path.

## UI V2 Work

Implement the visual system described in `docs/UI-V2-BRIEF.md`.

Minimum scope:

- Dark premium sidebar with compact project cards, local/API status, and clear
  selected state.
- New top project header with save-state pill and settings control.
- Five-step horizontal workflow header with numbered circles and active line.
- Main card plus right-side quality/status panel on desktop.
- Shared design tokens from `docs/UI-V2-BRIEF.md`; avoid one-off colors, radii,
  shadows, and spacing.
- Polished Step 01 upload stage:
  - stronger drop zone
  - upload glow/drag state
  - six suggested angle cards
  - readiness/progress display in the right panel
- Compact Step 02 control group with immediate popover opening, no drawer, and
  the one-line promise below all controls.
- Step 03 two-column script layout with compact per-shot cards and top actions.
- Step 04 independent `0-10s` and `10-20s` loading/result cards with partial
  success and targeted retry.
- Unified card, button, input, dialog, toast, and progress styles.
- Motion polish using CSS/vanilla JS only:
  - hover lift
  - press feedback
  - panel fade/slide
  - upload glow
  - progress animation
  - reduced-motion support

## Implementation Notes

- Prefer CSS custom properties and existing vanilla JS modules.
- Do not add a framework.
- Do not add GSAP or animation dependencies unless Codex A explicitly approves
  that dependency in a separate contract update.
- Keep text concise and Chinese-first in the browser UI.
- Existing image URLs and generated local `/uploads/...` URLs must keep working.
- The user supplied readable screenshots of the DOCX. Their applicable visual,
  interaction, animation, and acceptance requirements are consolidated in
  `docs/UI-V2-BRIEF.md`.
- Do not migrate the app to Next.js, React, Tailwind, shadcn/ui, or Zustand just
  because they appear in the reference document. Reuse the current architecture.

## Verification

Run:

```powershell
node --check .\studio-v2\public\js\*.js
git diff --check
```

Browser smoke checks:

- Fresh project empty state looks polished and still creates a project.
- Step 01 upload area supports click, drag, preview, and image delete.
- Sidebar has no horizontal scrollbar and batch delete still works.
- Step 02 controls open and save correct hidden form values.
- Step 02 confirmation fits in the viewport with Chinese-first content and top
  confirm/back actions.
- Script page keeps two 10-second blocks readable on desktop.
- Selected shot count changes the number of shots produced per 10-second block.
- Visual failure page shows partial count and does not hide successful local
  storyboards.
- Final page shows two storyboard images and two scripts only.

Capture screenshots at:

- 1440 x 1100
- 1280 x 900

## Handoff

When done, commit all frontend changes and push `codex/frontend-ui-v2`
immediately. Do not leave the work only on the local machine. The coordinator
will review this branch, run checks, and merge it into the final `v2` version
only after approval.

Report:

- branch
- commit hash
- changed files
- screenshots checked
- commands run
- known visual compromises or remaining risks

# 20260614 Desktop UI Polish Pass

## Assumption

本轮按用户最新要求，先不要继续做手机端细节，优先把桌面网页端做得更接近目标效果图。业务流程、单版/双版、Step 04 生成故事版、Step 05 生成视频均保持不变。

## Current Repo

- Path: `E:\codex工作台\P001-codex_sp仓库`
- Repo: `https://github.com/jike072-collab/codex_sp`
- Branch: `codex/night-workbench-review`
- Local URL: `http://127.0.0.1:8810`

## Module

Desktop web visual polish.

## Changed

- `studio-v2/public/styles.css`
  - Added desktop-only layout overrides for `1440`, `1366`, and `1280` wide screens.
  - Tightened the three-column workbench proportions: main stage card plus right AI inspector panel.
  - Improved completed step styling with a clear green check state.
  - Strengthened the right AI inspector hierarchy: stage label, readiness card, progress, metrics, tips, and completion checklist.
  - Refined Step 05 video preview/download area so it reads as a deliberate workbench card instead of a loose media block.

- `docs/codex-review-workbench/20260614-ui-desktop-step05-1280x800.png`
  - Added desktop evidence screenshot for the single-version Step 05 success state.

## Verified

- `node --check studio-v2/public/js/render.js`
- `node --check studio-v2/public/js/demo-loop.js`
- `node --test studio-v2/tests/*.test.mjs` passed `63/63`.
- Local server returned HTTP `200`.
- In-app browser desktop checks:
  - `1440x900`: `scrollWidth=1425`, `clientWidth=1440`, no console error/warn.
  - `1366x768`: `scrollWidth=1351`, `clientWidth=1366`, no console error/warn.
  - `1280x800`: `scrollWidth=1265`, `clientWidth=1280`, no console error/warn.
- Step 04 smoke project:
  - Active step: `生成故事版`
  - Right panel: `AI 故事版检查`
  - Readiness: `故事版 0/1`
  - No public `API Key/provider/model/prompt` wording.
- Step 05 success project:
  - Project: `成功态预览下载烟测`
  - Active step: `生成视频`
  - Main title: `生成视频`
  - Right panel: `生成视频`
  - Readiness: `视频完成 1/1`
  - Video element exists with `/uploads/success-mqcnwruf/video-full-smoke.mp4`.
  - `下载视频` is visible.
  - No public `API Key/provider/model/prompt` wording.
  - Desktop screenshot saved at `docs/codex-review-workbench/20260614-ui-desktop-step05-1280x800.png`.

## Issue Found

- `node --check` is not valid for CSS files; CSS validation was covered through browser rendering and console checks instead.
- Mobile-specific polish is intentionally paused. Existing mobile baseline remains only “no obvious overflow/crash,” per user priority.

## Next Step

Continue desktop-first polishing only if new visual issues are found in the live browser. Do not expand scope into mobile details until the desktop flow is accepted.

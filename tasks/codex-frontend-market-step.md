# Codex B Task: Complete Demo Loop Frontend

## Identity

You are Codex B. The original market-step implementation has already been
integrated into `main` and the visible workflow has changed. Before doing any
new frontend work, sync from `main` and treat this file as historical context
plus the follow-up notes below.

Branch:

```text
codex/frontend-market-step
```

Write scope:

```text
studio-v2/public/**
```

Do not edit backend, schema, prompt, storage, or root documentation files.

## Starting Point

Read in this order:

1. `CURRENT_ASSIGNMENTS.md`
2. `AGENTS.md`
3. `docs/contracts/market-creative-api.md`
4. `docs/contracts/demo-loop-api.md`
5. `studio-v2/public/index.html`
6. `studio-v2/public/js/core.js`
7. `studio-v2/public/js/render.js`
8. `studio-v2/public/js/projects.js`
9. `studio-v2/public/js/main.js`

The existing application already supports:

```text
create project -> upload shoe images -> analyze -> review product lock
```

After product-lock review, the project status becomes `market`. The current UI only shows a placeholder at that stage.

## Goal

Do not continue the old placeholder-replacement task as-is. The current UX is:
upload -> background analyze -> Step 02 product lock and creative settings ->
summary dialog -> Step 04 script -> visual -> export.

Current follow-up work for Codex B is browser QA and small UI polish only:

- Verify Step 02 after upload immediately shows the review/creative page while
  analysis is still running.
- Verify the audience card picker, video-size drawer, creative stack, top action
  buttons, summary dialog, shot-count selector, and script progress bar.
- Verify the API settings dialog shows three independent key fields, each with
  role/channel/model details and a show/hide button for newly typed keys.
- Verify the selected Step 02 aspect ratio is shown on the final delivery page
  and both storyboard images use that same ratio.
- Verify image generation immediately opens the final delivery progress view.
- Verify failed image generation shows the provider error and a retry button.
- Verify each generated storyboard image opens in a new tab when clicked.
- Verify final delivery contains only two storyboard images and the matching
  0-10s and 10-20s script copy actions.
- Verify no keyframe, storage-location selector, or Flow Omni section remains.
- Do not add or depend on `rightCodesApiKey`.
- Do not edit backend/provider/storage contracts from the frontend branch.

The user must be able to:

1. Review the confirmed shoe summary.
2. Choose the target country.
3. Edit the target audience.
4. Select one creative theme.
5. Enter a core message.
6. Choose a tone.
7. Save the market brief.
8. See clear saving, success, and error states.

Then the user must be able to:

1. Generate a deterministic demo script.
2. Edit all shot text fields.
3. Confirm the edited script.
4. Generate two segment-specific storyboard images.
5. Copy each matching 10-second script.
6. Download the JSON delivery package.
7. Reopen a project and resume from its persisted stage.

## Required Fields

Use these exact field names:

```json
{
  "marketBrief": {
    "targetCountry": "Thailand",
    "audience": "日常运动与通勤人群",
    "creativeTheme": "city-motion",
    "coreMessage": "轻快、稳定，适合每天出发",
    "tone": "energetic",
    "outputAspectRatio": "9:16"
  }
}
```

Allowed `creativeTheme` values:

```text
city-motion
daily-comfort
performance-detail
street-style
```

Allowed `tone` values:

```text
energetic
clean
warm
bold
```

Use the API contract in `docs/contracts/market-creative-api.md`. Do not invent another endpoint or payload.

For script, visual, and export stages, use `docs/contracts/demo-loop-api.md` exactly.

## Interaction Requirements

- Preserve the current visual language and responsive behavior.
- Do not add a framework or npm dependency.
- Keep ES modules under `studio-v2/public/js/`.
- Pre-fill country and audience from the project.
- Pre-fill saved `project.marketBrief` when reopening a project.
- Disable submission while saving.
- Show API failures through the existing toast.
- After success, render a confirmation state for status `script`.
- Allow the user to return to the market form for local editing without mutating backend state until Save is clicked.
- Do not expose API keys or provider configuration.
- When status is `script` and no planning package exists, show Generate Script.
- When status is `script` and a planning package exists, render editable segment and shot fields.
- Submit the complete edited planning package to the confirm endpoint.
- Visual prompts are read-only and copyable.
- Omni packages are read-only and copyable.
- Export uses a normal browser download from the documented GET endpoint.

## Suggested File Ownership

You may create:

```text
studio-v2/public/js/market.js
```

Likely edits:

```text
studio-v2/public/index.html
studio-v2/public/styles.css
studio-v2/public/js/main.js
studio-v2/public/js/render.js
studio-v2/public/js/projects.js
```

Do not perform unrelated redesign or formatting.

## Acceptance Criteria

- A project with status `market` displays the market creative form.
- Existing project country and audience are pre-filled.
- All required fields are validated before submission.
- Submit calls `POST /api/projects/:id/market` with the exact contract.
- Successful response updates local state and advances the UI to `script`.
- Reopening a saved project restores `marketBrief`.
- Script generation and confirmation use the exact frozen contract.
- Script edits survive reopening after confirmation.
- Visual generation displays four prompts and two Omni packages.
- Export downloads the JSON delivery package.
- Existing asset upload and product-lock review flows still work.
- All changed JavaScript modules parse successfully.
- No files outside `studio-v2/public/**` are changed.

## Handoff

Final response must include:

- Branch and latest commit.
- Files changed.
- User-visible behavior.
- API assumptions.
- Verification performed.
- Known limitations.

# 2026-06-14 P0 Flow Smoke

## Scope

Verify the first-version beginner flow on local `8810` without relying on GitHub README:

`create project -> upload shoe image -> analyze -> review -> market brief -> generate script -> confirm script -> generate storyboard`

The local machine currently has no real image generation key configured, so Step 04 is expected to enter a safe failure state with a retry entry.

## Local State

- Repo: `E:\codex工作台\P001-codex_sp仓库`
- Branch: `codex/night-workbench-review`
- URL: `http://127.0.0.1:8810`
- Smoke script: `docs/codex-review-workbench/p0-flow-smoke.mjs`
- Sample image: local smoke image under `studio-v2/data/uploads/`

## API Evidence

Command:

```powershell
node docs/codex-review-workbench/p0-flow-smoke.mjs
```

Observed result:

```json
{
  "projectId": "mqd4hjnn-ea8fc70f",
  "statuses": {
    "created": 201,
    "uploaded": 200,
    "analyzed": 200,
    "reviewed": 200,
    "marketed": 200,
    "scripted": 200,
    "confirmed": 200,
    "visual": 502,
    "reopened": 200
  },
  "finalProjectStatus": "visual",
  "workflowMode": "single_video",
  "assetCount": 1,
  "storyboardCount": 1,
  "visualFailureCode": "IMAGE_PROVIDER_NOT_CONFIGURED"
}
```

## Browser Evidence

Opened the smoke project in the 1440x900 browser viewport.

Verified:

- Active stage is `visualStage`.
- Step 04 panel title is `AI 故事版检查`.
- Right panel readiness shows `故事版 0/1`.
- Main copy says `故事版暂时没有生成成功，请稍后重试。`
- Retry entry is visible as `重新生成故事版`.
- No visible `API Key`, provider, model, prompt, Right Code, DeepSeek, Gemini, Draw, `绘图通道`, or `未配置` wording.
- No `导出计划`, `最终导出`, `最终交付`, or `故事板图片` wording.
- Console error/warning list is empty.
- `scrollWidth=1425`, `clientWidth=1440`, no document-level horizontal overflow.

## Result

P0 path is confirmed through Step 04 failure recovery for the no-key local environment. The user can retry storyboard generation without seeing technical provider details.

Step 05 success preview/download remains covered by the existing local success smoke project, not by a live external provider run.

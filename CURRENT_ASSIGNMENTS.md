# 当前并行分工

当前进入 `v2` 后续修正轮。两个 Codex 都必须先读取
`AGENTS.md`、`CODEX_RUNBOOK.md`、`docs/MODEL-ROUTING.md` 和
`docs/UI-V2-BRIEF.md`，再按任务难度选择模型。

## Codex A：后端与集成

负责：

- `studio-v2/src/**`
- `studio-v2/server.mjs`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`
- `prompts/**`
- 合并、回归测试和 GitHub 主分支

本轮任务入口：`tasks/codex-backend-image-concurrency.md`。

重点：验证并修复“两张故事板图片是否真正同时发起生成请求”。必须用测试证明
两个 provider 请求重叠开始，不能只说代码用了 `Promise.allSettled`。

## Codex B：浏览器前端

负责：

- `studio-v2/public/**`

本轮任务入口：`tasks/codex-frontend-ui-v2-density-followup.md`。

Codex B 在另一台电脑工作，必须通过 GitHub 仓库领取任务。开始前同步最新
`main`，以仓库中的任务文件、冻结契约和提交为准，不依赖聊天记录。

重点：根据 `docs/reference/ui-v2-followup/` 里的图片压缩顶部空间、减少滚动，
让五个步骤更接近参考图的一屏可见效果。完成后立即提交并推送新分支供协调者审核。

两个 Codex 完成各自任务后必须立即提交并推送到自己的任务分支，不要只保留
本地改动。协调者会先核对分支内容、运行必要检查、确认 UI 和流程没有问题，
再合并成正式 `v2` 版本。

## 当前交付目标：v2 follow-up

- 后端确认两张故事板真实并发请求，必要时修复。
- 前端减少页面滑动，压缩无用顶部区域，按参考图优化五步布局。
- 故事板尺寸规则：外层故事板交付图不强行套用第二步视频比例；故事板内部每个
  分镜画面必须按第二步选择的比例构图。前端显示外层故事板时要贴合真实图片比例，
  不要放进一个大而空的横向框。
- 保留当前完整工作流、img2img-only 生图、部分成功展示和最终两图两脚本交付。

当前分支建议：

- Codex B：`codex/frontend-ui-v2-density`
- Codex A：`codex/backend-image-concurrency`

两个分支必须从任务文件标注的 base commit 开始，完成后通过 GitHub 提交。

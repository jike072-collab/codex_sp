# 当前并行分工

当前进入 `ui-v2` 第二版视觉升级轮。两个 Codex 都必须先读取
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

本轮任务入口：`tasks/codex-backend-ui-v2.md`。

## Codex B：浏览器前端

负责：

- `studio-v2/public/**`

本轮任务入口：`tasks/codex-frontend-ui-v2.md`。

Codex B 在另一台电脑工作，必须通过 GitHub 仓库领取任务。开始前同步最新
`main`，以仓库中的任务文件、冻结契约和提交为准，不依赖聊天记录。

两个 Codex 完成各自任务后必须立即提交并推送到自己的任务分支，不要只保留
本地改动。协调者会先核对分支内容、运行必要检查、确认 UI 和流程没有问题，
再合并成正式 `v2` 版本。

## 当前交付目标：ui-v2

- 以美观度、统一风格、交互反馈和动画质感为主。
- 前端实现新的 `ui-v2` 工作台视觉语言。
- 后端只做必要的接口保护、测试和集成，不参与样式实现。
- 保留当前完整工作流、img2img-only 生图、部分成功展示和最终两图两脚本交付。

当前分支建议：

- Codex B：`codex/frontend-ui-v2`
- Codex A：`codex/backend-ui-v2-support`

两个分支必须从任务文件标注的 base commit 开始，完成后通过 GitHub 提交。

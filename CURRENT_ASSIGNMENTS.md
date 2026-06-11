# 当前并行分工

当前进入 P0 工作台问题修正轮。所有 Codex 开始前必须先读取：

- `AGENTS.md`
- `CODEX_RUNBOOK.md`
- `docs/TASKS.md`
- 自己对应的 `tasks/*.md`

任务文件、冻结后的后端契约和远端分支状态优先于聊天记录。

每次任务或续接任务开始时，前端、后端和审核 Codex 都必须依次调用：

1. `$nadirclaw-model-router`
2. `$superpowers-workflow`

开工状态更新和最终交接必须包含：

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: simple|standard|complex
```

如果另一台电脑没有这两个技能，先运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-codex-skills.ps1
```

安装后开启新线程，再领取任务。

## 当前开工状态

- 后端 P0 已完成、通过回归测试并合入本轮 `main` 基线。
- 前端任务分支已从包含后端契约的最新 `main` 建立。
- 前端任务分支相对最新 `main` 只能修改 `studio-v2/public/**`。
- 协调端负责后端合并、任务发布、前端 PR 审核、回归测试和正式分支同步。

## Codex A：后端、协调与集成

负责：

- `studio-v2/src/**`
- `studio-v2/server.mjs`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`
- `prompts/**`
- 任务拆分、代码审核、回归测试与正式分支合并

本轮任务入口：

- `tasks/codex-backend-p0-storyboard-state.md`

本轮后端结果：

- 故事板生成、部分成功、失败与重试均属于 Step 4。
- 只有两张真实故事板图片完成后才能进入 Step 5。
- 生图保持 img2img-only，不允许 prompt-only fallback 或演示降级图。
- 两张故事板继续并发请求。
- 成功图片会保留，重试只补缺失图片。
- Right Code `excessive system load` 被识别为可重试的 provider overload。
- 后端回归测试必须全部通过后才能合入 `main`。

后端任务分支：

- `codex/backend-p0-storyboard-state`

## Codex B：浏览器前端

负责且只能修改：

- `studio-v2/public/**`

本轮任务入口：

- `tasks/codex-frontend-p0-workbench-review.md`

参考图片：

- `docs/reference/workbench-p0-user-feedback/`

前端必须全部处理：

- 上传图片删除按钮可点击。
- 第四张上传图片完整显示，不裁掉商品。
- 顶部五步流程不遮挡文字，步骤编号和文字使用清楚的块状/方框布局。
- Step 2 设置项和 Product Lock 使用统一方框卡片效果。
- Step 2 未完成第四张图片/检查点和确认前，不允许进入 Step 3。
- 确认弹窗无横向滚动条、无文字遮挡。
- 脚本和故事板生成进度持续反馈，不出现长时间静止的假进度。
- Step 3 脚本编辑器按参考图做成中文可读的镜头卡片布局。
- 中文仅用于界面标签；后台生成语言继续使用当前选择国家对应的语言。
- 故事板 0/2、1/2、2/2、失败与重试都在 Step 4 展示。
- Step 5 只保留两张故事板图片和两段脚本/复制控件。
- 不恢复 JSON、ZIP、CSV、Flow Omni 下载按钮。

前端开工分支：

- `codex/frontend-p0-workbench-review`

前端开工命令：

```powershell
git fetch origin
git switch codex/frontend-p0-workbench-review
git pull --ff-only origin codex/frontend-p0-workbench-review
```

协调端会先保证远端前端任务分支与最新 `main` 完全相同。前端完成上述命令后，
再开始修改 `studio-v2/public/**`。

## PR 与审核要求

前端完成后必须提交并推送 `codex/frontend-p0-workbench-review`，然后交给协调端审核。

PR/审核材料必须包括：

- 已调用技能：`nadirclaw-model-router`、`superpowers-workflow`
- 本次 Route
- 改动说明和文件列表
- 上传删除状态截图
- Step 2 设置和 Product Lock 截图
- Step 2 确认弹窗截图
- Step 3 中文脚本编辑器截图
- Step 4 生成中、部分成功或失败状态截图
- Step 5 最终交付截图
- 前端全部 JS 文件语法检查结果
- 未完成项；正常情况下应为空

协调端在合并前必须：

- 检查前端只修改 `studio-v2/public/**`
- 运行全部后端测试
- 运行全部前端 JS 语法检查
- 启动本地服务并检查五步流程
- 确认所有用户反馈项均完成后再合并

# Codex B Current Frontend Task

Status: READY

Route: complex

Base commit: `f996758`

Branch: `codex/frontend-admin-provider-ux`

Backend dependency branch: `codex/backend-storyboard-524-model-discovery`

## Required Skills

Start every task or resumed task with:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## Goal

把工作台前端做成更清楚、更像正式工具的样子，重点修掉“太小、重复、留空、发黑、被裁切”的问题，并让管理后台和主工作台统一成一套视觉语言。

## Frontend Work

1. 工作台顶部那四个小块替换成更有用的内容，不要再放意义不大的小字块。
2. 全局字号、层级和对比度调高一点，避免“全黑一片”且看不清。
3. Step 02 的每个选项卡前缀改成图标或徽标式表达，不能再留空白占位。
4. Step 02 的文字框、间距、对齐与其它步骤保持一致，切换时不能抖动。
5. 去掉底部重复出现的新块，不要同一信息出现两次。
6. Step 03 脚本区改成更像表格的展示，一张镜头卡片只出现一次，信息按行/列清楚展开。
7. 右侧裁切、局部显示不全、内容被挡住的问题要一起修掉。
8. 管理后台也要和主工作台统一风格，别像另一套系统。
9. 全部可见界面文案保持中文，技术值可以保留原样。

## Scope

Allowed:

- `studio-v2/public/**`
- `studio-v2/admin/**`（只在确有必要时）

Do not edit:

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`
- root coordination files
- `.env`, API keys, runtime data, uploads, generated images, logs, or PID files

## Coordination

- 这轮前端只做布局、视觉和信息组织，不碰后端接口逻辑。
- 后端双 key / 模型发现先按后端任务走，前端只消费稳定结果。
- 如果某个改动会影响 Step 02 / Step 03 的稳定布局，先保尺寸再谈美化。
- 这份任务只发给另一台电脑，通过 GitHub 分支和任务文件执行，不走本机前端对话。

## Verification

- Run syntax checks for every JS file under `studio-v2/public/js` and `studio-v2/admin`.
- Start the local service.
- Verify the top four blocks are replaced by clearer content.
- Verify Step 02 has no blank prefix boxes and no layout jump.
- Verify Step 03 looks like a table-like layout and does not duplicate a shot card.
- Verify no horizontal page scroll and no clipped right edge.
- Verify all visible text is Chinese.
- Verify the admin page uses the same visual language as the workbench.
- Provide screenshots of the updated workbench and admin page.

## Delivery

Push `codex/frontend-admin-provider-ux` and report:

- Skills and route
- Commit hash
- Changed files
- JS checks
- Browser viewport checks
- Screenshots
- Confirmation that no backend files or secrets were changed

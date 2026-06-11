# 当前并行分工

所有 Codex 开始或续接任务前必须依次调用：

1. `$nadirclaw-model-router`
2. `$superpowers-workflow`

开工与交付必须包含：

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: simple|standard|complex
```

任务文件、冻结契约和 GitHub 分支提交优先于聊天记录。

## 任务发布方式

- 本机后端任务：协调端写入任务文件，并直接发到本地后端 Codex 对话。
- 另一台电脑前端任务：协调端只通过任务文件和 GitHub 分支发布；前端机自行 fetch/pull 后直接推送 GitHub。
- 另一台电脑的前端任务不走本机对话，本机只做后端、协调和审核。
- 前端交付以 GitHub 分支、任务文件状态和回报为准。

## 当前基线

- 正式基线：`f996758`
- 正式分支：`main / v2 / ui-v2`
- 协调端负责发布任务、审查、回归测试与正式分支同步。

## Codex A：后端

状态：READY

任务入口：

- `tasks/codex-backend-current.md`

任务分支：

- `codex/backend-storyboard-524-model-discovery`

负责内容：

- 故事板图片生成改为两个独立 key / 两条绘图通道。
- 两张故事板仍保持并发发起，partial success 保留成功图，只补缺失图。
- 后台模型列表读取当前 key 可调用的真实模型，支持刷新与切换。
- 保持 masked key preview、中文 schema、无密钥泄露。
- 继续排查 524 的真实原因，并补足诊断与测试。

允许修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`

禁止修改：

- `studio-v2/public/**`
- `studio-v2/admin/**`

## Codex B：前端

状态：READY

任务入口：

- `tasks/codex-frontend-current.md`

任务分支：

- `codex/frontend-admin-provider-ux`

负责内容：

- 工作台顶部四个小块改成更有用、可读性更强的内容。
- Step 02 的每个选项卡前缀改成图标或徽标式表达，不能留空白占位。
- 去掉底部重复出现的新增块。
- Step 03 脚本区改成更像表格的展示，不再重复堆同一张卡片。
- 统一中文显示，提升字号、对比度和可读性，避免页面过暗。
- 管理后台风格也要和主工作台统一，不要像另一套系统。
- 修复右侧裁切和布局抖动。

允许修改：

- `studio-v2/public/**`
- `studio-v2/admin/**`（仅在确有必要时）

禁止修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`

## 固定产品规则

- 生图只能 img2img，不允许 prompt-only fallback。
- 两张故事板必须同时发起；成功图保留，重试只补缺失。
- 最终交付只保留两张故事板图片和两段脚本/复制控件。
- 不恢复 JSON / ZIP / CSV / Flow Omni 下载按钮。
- 外层 storyboard sheet 不强行套视频比例；内部 shot frames 才按第二步比例构图。

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

- 正式基线：`fa1ca03`
- 正式分支：`main / v2 / ui-v2`
- 协调端负责发布任务、审查、回归测试与正式分支同步。

## Codex A：本机后端

状态：READY - START NOW

任务入口：

- `tasks/codex-backend-current.md`

任务分支：

- `codex/backend-single-image-regression`

负责内容：

- 确认并固定“上传 1 张图片即可识别”的后端契约。
- 一张图片可以是包含正面、侧面、后跟、鞋底的四视图拼图。
- 补单图上传、分析和删除素材的回归测试。
- 检查识图提示是否会正确理解单张多视图拼图，不要求用户拆成 4 个文件。

允许修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- 必要的后端契约文档

禁止修改：

- `studio-v2/public/**`
- `studio-v2/admin/**`

## Codex B：另一台电脑前端

状态：READY - START NOW

任务入口：

- `tasks/codex-frontend-current.md`

任务分支：

- `codex/frontend-step1-single-image`

负责内容：

- Step 01 改为上传至少 1 张图片即可点击“识别并锁定产品”。
- 单张四视图拼图视为完整可识别素材；4-8 张只保留为建议，不得作为门槛。
- 修复素材卡片删除按钮无法点击，必须在真实浏览器中完成删除闭环。
- 清除所有 `1/4`、还需 3 张、第四张检查点等硬门槛显示。
- 放大正文、按钮、提示和右侧状态区字号，改善对比度。
- 去掉第一步大块无意义空白，让面板高度随实际内容收缩。

允许修改：

- `studio-v2/public/**`

禁止修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `studio-v2/admin/**`
- 后端契约文件

## 固定产品规则

- 生图只能 img2img，不允许 prompt-only fallback。
- 两张故事板必须同时发起；成功图保留，重试只补缺失。
- 最终交付只保留两张故事板图片和两段脚本/复制控件。
- 不恢复 JSON / ZIP / CSV / Flow Omni 下载按钮。
- 外层 storyboard sheet 不强行套视频比例；内部 shot frames 才按第二步比例构图。
- Step 01 最少 1 个图片文件即可识别；单个文件允许包含多角度拼图。

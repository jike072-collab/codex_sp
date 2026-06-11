# Codex A Current Backend Task

Status: READY - START NOW

Target: 本机后端 Codex 对话

Published: 2026-06-11 Asia/Shanghai

Route: standard

Branch: `codex/backend-single-image-regression`

Start from: latest `origin/main`

## Required Skills

Start every task or resumed task with:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: standard
```

## Goal

固定“上传一个图片文件即可开始识别”的后端行为。一张图片可以是包含正面、侧面、后跟、鞋底等角度的四视图拼图，后端不得要求拆成四个文件。

## Backend Work

1. 核对上传和 `POST /api/projects/:id/analyze` 的全部后端校验，最小素材数必须为 1。
2. 核对视觉识别请求会把单张四视图拼图作为完整参考图传给 provider。
3. 如提示词存在“每张图只含一个角度”的隐含假设，改为明确允许单图内包含多个产品角度。
4. 补回归测试：
   - 只上传 1 张图片后可以调用 analyze。
   - 单张图片会进入视觉 provider，不会因文件数不足被拒绝。
   - assets 阶段删除唯一一张素材后，项目回到 0 张且文件被移除。
   - 0 张素材调用 analyze 仍返回明确错误。
5. 不要引入图片拆分、自动裁图或额外 AI 调用；provider 直接识别原始拼图即可。

## Scope

Allowed:

- `studio-v2/src/**`
- `studio-v2/tests/**`
- 必要的后端契约文档

Do not edit:

- `studio-v2/public/**`
- `studio-v2/admin/**`
- root coordination files
- `.env`、API Key、运行数据、上传图片、生成结果、日志或 PID 文件

## Verification

- 运行相关 API / provider 测试。
- 运行全部后端测试。
- 对修改的 MJS 文件执行语法检查。
- 明确报告单张四视图拼图是否无需拆分即可识别。

## Delivery

Push `codex/backend-single-image-regression` and report:

- Skills and route
- Commit hash
- Changed files
- Tests and exact pass counts
- Confirmation that no frontend/Admin files or secrets were changed

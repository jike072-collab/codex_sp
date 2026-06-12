# Codex A Current Backend Task

Status: READY - START NOW

Target: 本机后端 Codex 对话

Published: 2026-06-12 Asia/Shanghai

Route: complex

Branch: `codex/backend-video-generation-provider`

Start from: latest `origin/main` at or after `64bf753`

## Required Skills

Start every task or resumed task with:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## Goal

把 Step 05 从“导出两张故事板和两段脚本”升级为“生成最终视频”的后端能力。先完善功能，不接消费系统。

默认视频模型使用 `clmm-mall.top` 平台的 `seedance2.0 720p-fast`，接口形态按 OpenAI-video 兼容通道接入。价格只作为内部选型参考，不进入产品 UI，不做扣费、余额、支付或消费记录。

## Backend Work

1. 冻结视频生成契约：
   - 新建或更新 `docs/contracts/video-generation-api.md`。
   - 更新 `schemas/studio-project.schema.json`。
   - 明确 `videoPackage` / `video_generation[]` 数据结构。
2. 新增视频 provider：
   - 建议文件：`studio-v2/src/ai-providers/video-provider.mjs`。
   - 默认 API URL、模型和 key 从 `.env` / provider settings 读取。
   - 默认模型：`seedance2.0 720p-fast`。
   - 支持 OpenAI-video 风格请求，不要硬编码真实密钥。
3. Provider 输入必须来自当前项目：
   - `0-10s` 段脚本 + 对应故事板图。
   - `10-20s` 段脚本 + 对应故事板图。
   - 项目上传的商品参考图可作为辅助参考。
   - 使用第二步选择的 `marketBrief.outputAspectRatio`。
4. 新增视频工作流 API，命名可按现有 route 风格微调，但必须在契约中固定：
   - `POST /api/projects/:id/videos/generate`
   - `GET /api/projects/:id/videos/status`
   - `POST /api/projects/:id/videos/:segmentId/retry`
   - `GET /api/projects/:id/videos/:segmentId/download`
   - 可选：`GET /api/projects/:id/videos/final/download`
5. 视频状态最少覆盖：
   - `waiting`
   - `submitting`
   - `queued`
   - `generating`
   - `downloading`
   - `done`
   - `failed`
6. 保留 partial success：
   - 两段视频可并发提交。
   - 成功段保留。
   - 失败段只重试本段。
   - 不因一段失败删除另一段成功结果。
7. 视频结果保存：
   - 生成视频下载到本地项目 uploads 目录或专用 generated 目录。
   - project JSON 只存相对 URL、mime、大小、生成时间、segment id、安全诊断摘要。
8. 最终合并：
   - 如果本机可用 `ffmpeg`，可以自动合并两段视频为最终视频。
   - 如果没有 `ffmpeg`，后端必须优雅降级：返回两段视频，不报失败。
   - 不要引入必须全局安装的新依赖。
9. Admin provider schema 增加 `video` provider：
   - API URL
   - Model
   - API Key masked preview
   - 可选模型列表
   - 不返回完整 key。
10. 安全诊断：
    - 可以记录 segment id、model、provider host/path、状态码、耗时、请求 id、输入数量、输出大小。
    - 不得记录完整 key、prompt、base64、图片内容、视频内容或 provider 完整响应体。

## Explicitly Out Of Scope

本轮不要做：

- 用户余额
- 扣费
- 支付
- 消费记录
- 价格计算
- 套餐、分组、额度
- 用量统计仪表盘
- 主工作台显示单次价格
- Flow 网页登录自动化
- Gemini Omni 网页自动化
- sub2api 集成

## Scope

Allowed:

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`

Do not edit:

- `studio-v2/public/**`
- `studio-v2/admin/**`
- root coordination files
- `.env`、API Key、运行数据、上传图片、生成结果、日志或 PID 文件

## Verification

- 视频契约测试。
- Provider 请求构造测试：包含脚本、故事板、参考图和比例。
- 两段视频并发提交测试。
- partial success / retry only missing segment 测试。
- 下载和本地保存测试。
- 无 key / no configured provider 的中文错误测试。
- Admin provider schema 的 masked key 和 video provider 测试。
- 无敏感信息泄露测试。
- 运行全部后端测试。
- 对修改的 MJS 文件执行语法检查。

## Delivery

Push `codex/backend-video-generation-provider` and report:

- Skills and route
- Commit hash
- Video contract summary
- Provider request/response shape
- Changed files
- Tests and exact pass counts
- Confirmation that no frontend/Admin files or secrets were changed

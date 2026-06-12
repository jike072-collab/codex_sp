# Codex A Current Backend Task

Status: CHANGES REQUESTED - REVISE EXISTING IMPLEMENTATION

Target: 本机后端 Codex 对话

Published: 2026-06-12 Asia/Shanghai

Route: complex

Branch: `codex/backend-video-generation-provider`

Start from: latest `origin/main`

## Required Skills

Start every task or resumed task with:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## Goal

把当前默认工作流调整为“一个脚本、一张故事板、一个视频”。视频时长在 Step 02 选择，范围 `5-15` 秒，默认 `10` 秒；脚本时间线、分镜、故事板和视频都必须跟随这个时长。

默认视频模型使用 `clmm-mall.top` 平台的 `seedance2.0 720p-fast`，接口形态按 OpenAI-video 兼容通道接入。价格只作为内部选型参考，不进入产品 UI，不做扣费、余额、支付或消费记录。

已有提交 `c930526` 按旧要求实现了两段视频。不要丢弃该实现，也不要从头重写；在其基础上增加当前默认的 `single_video` 模式，并保留原来的双段能力作为 legacy / future multi-segment 模式。

## Backend Work

1. 冻结单视频默认模式契约：
   - 新建或更新 `docs/contracts/video-generation-api.md`。
   - 更新 `schemas/studio-project.schema.json`。
   - 新项目默认工作流模式为 `single_video`。
   - `marketBrief` 或等价稳定位置增加 `videoDurationSeconds`，整数范围 `5-15`，默认 `10`。
   - 明确单脚本、单故事板和单视频的数据结构。
   - 保留旧 `0-10s` / `10-20s` 双段数据结构兼容，不删除旧字段、旧解析和旧测试。
2. 新增视频 provider：
   - 建议文件：`studio-v2/src/ai-providers/video-provider.mjs`。
   - 默认 API URL、模型和 key 从 `.env` / provider settings 读取。
   - 默认模型：`seedance2.0 720p-fast`。
   - 支持 OpenAI-video 风格请求，不要硬编码真实密钥。
3. Provider 输入必须来自当前项目：
   - 当前模式的一条完整脚本。
   - 当前模式的一张故事板图。
   - 项目上传的商品参考图可作为辅助参考。
   - 使用第二步选择的 `marketBrief.outputAspectRatio`。
   - 明确传递 `videoDurationSeconds`，不能继续写死 10 秒或 20 秒。
4. 脚本和分镜必须跟随所选时长：
   - 新单视频脚本时间线从 `0` 开始，以 `videoDurationSeconds` 结束。
   - 镜头之间不能重叠或留空，最后一个镜头结束时间必须等于所选时长。
   - 镜头数量根据时长自动决定，不再要求用户为当前单视频模式手工选择“每段镜头数”。
   - demo 脚本和真实模型脚本都要遵守同一时长契约。
5. 故事板必须跟随单脚本：
   - 当前模式只创建一个 `storyboard_board`。
   - 故事板内部镜头数量、时间标签和脚本一致。
   - 仍然是 img2img，必须带商品参考图。
   - 旧双故事板、双绘图通道代码不得删除，legacy 项目继续可读。
6. 视频工作流 API，命名可按现有 route 风格微调，但必须在契约中固定：
   - `POST /api/projects/:id/videos/generate`
   - `GET /api/projects/:id/videos/status`
   - `POST /api/projects/:id/videos/:segmentId/retry`
   - `GET /api/projects/:id/videos/:segmentId/download`
   - 可选：`GET /api/projects/:id/videos/final/download`
7. 视频状态最少覆盖：
   - `waiting`
   - `submitting`
   - `queued`
   - `generating`
   - `downloading`
   - `done`
   - `failed`
8. 当前模式只生成一个视频：
   - 新项目只创建一个视频任务。
   - 失败后重试该视频任务。
   - 旧双段项目继续保留原来的 partial success 和只补失败段逻辑。
9. 视频结果保存：
   - 生成视频下载到本地项目 uploads 目录或专用 generated 目录。
   - project JSON 只存相对 URL、mime、大小、生成时间、segment id、安全诊断摘要。
10. 当前单视频模式不需要 ffmpeg 合并：
   - 不要为了当前单视频流程强制引入 ffmpeg。
   - 已有 legacy 双段合并能力可以保留，但不能成为当前模式依赖。
11. Admin provider schema 增加 `video` provider：
   - API URL
   - Model
   - API Key masked preview
   - 可选模型列表
   - 不返回完整 key。
12. 安全诊断：
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
- `videoDurationSeconds` 的 `5`、`10`、`15` 秒边界测试。
- 单脚本时间线完整覆盖所选时长测试。
- 当前模式只生成一个故事板和一个视频任务测试。
- provider 请求包含正确 duration 测试。
- legacy 双段项目仍可读取、双通道能力未删除测试。
- legacy partial success / retry only missing segment 测试保留。
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

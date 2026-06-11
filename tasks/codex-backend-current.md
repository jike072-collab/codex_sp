# Codex A Current Backend Task

Status: READY

Route: complex

Base commit: `f996758`

Branch: `codex/backend-storyboard-524-model-discovery`

## Required Skills

Start every task or resumed task with:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## Goal

把后端改成“两个故事板 key / 两条绘图通道 + 真实模型发现”的正式实现，并保住并发、部分成功和无密钥泄露。

## Review Blocker To Fix

P1: 模型发现缓存必须绑定“当前 key”，不能只区分是否已配置。

- 位置：`studio-v2/src/ai-providers/provider-models.mjs`
- 现状：缓存 key 只包含 provider、url、model 和 `configured/missing-key`。
- 风险：用户更换 API Key 后，不带 `refresh=1` 时可能继续看到上一个 key 能调用的模型列表。
- 要求：
  - 缓存 key 必须随实际 key 改变而改变。
  - 不能把完整 API Key 写进日志、响应、诊断或可读缓存。
  - 可使用安全哈希/短指纹作为内部缓存 key 的一部分。
  - 补测试：同 provider/url/model 下更换 key 后，普通读取也必须重新请求模型列表；旧 key 的模型列表不能复用给新 key。
  - 保留 `refresh=1` 强制刷新能力。

## Backend Work

1. 故事板图片生成直接改为两个独立 key / 两条绘图通道。
2. 两张故事板仍必须并发发起，成功图保留，重试只补缺失图。
3. 后台模型列表从当前 key 可调用的真实模型中读取，支持刷新、切换和缓存。
4. Admin 返回的模型与 provider schema 必须可直接给前端渲染，显示为中文友好内容。
5. API Key 只能返回 masked preview，不能返回完整 key。
6. 继续保留 524 诊断，但要围绕“哪条通道、哪个 key、哪个模型、哪个请求字段”定位，不要泄露 prompt、base64、密钥或响应体。

## Must Prove

- 两个故事板请求仍然是并发进入 provider。
- 双 key / 双通道配置是显式的，不是静默 fallback。
- 模型发现来自真实 provider 能力，不得虚构模型。
- `GET /api/admin/providers/models`
  - 支持 `refresh=1`
  - 支持 `vision` / `text` / `image`
  - 失败时只返回安全错误
- `GET /api/admin/providers`
  - 返回 masked key preview
  - model 字段使用可选项/选择型 schema

## Current Facts

- `generateProjectVisuals()` 已经会并发请求两个故事板项。
- 现在的问题不是“是否并发”，而是“如何稳定地用双 key / 双通道把两张图都跑出来，并把失败原因查清楚”。
- 524 仍按 provider/gateway timeout 方向排查，但这轮要直接落地双通道方案，不再等待额外证明。

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
- `.env`, API keys, runtime data, uploads, generated images, logs, or PID files

## Verification

- Storyboard concurrent-start test.
- Dual-key / dual-channel contract test.
- Model discovery success / unsupported / error / refresh tests.
- Masked key preview and select-type schema test.
- No secret leakage in diagnostics.
- Run all backend tests.
- Run syntax checks for changed MJS files.

## Delivery

Push `codex/backend-storyboard-524-model-discovery` and report:

- Skills and route
- Commit hash
- 双 key / 双通道实现说明
- 模型发现来源与缓存方式
- Changed files
- Tests
- Confirmation that no frontend/Admin files or secrets were changed

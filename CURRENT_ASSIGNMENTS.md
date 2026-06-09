# 当前并行分工

本轮前后端任务已经完成并合并到 `main`。新的工作开始前，两个 Codex 都必须
先读取 `AGENTS.md`、`CODEX_RUNBOOK.md` 和 `docs/MODEL-ROUTING.md`，再按任务
难度选择模型。

## Codex A：后端与集成

负责：

- `studio-v2/src/**`
- `studio-v2/server.mjs`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`
- `prompts/**`
- 合并、回归测试和 GitHub 主分支

本轮任务记录：`tasks/codex-backend-current.md`（已完成）。

## Codex B：浏览器前端

负责：

- `studio-v2/public/**`

本轮任务记录：`tasks/codex-frontend-current.md`（已完成）。

Codex B 在另一台电脑工作，必须通过 GitHub 仓库领取任务。开始前同步最新
`main`，以仓库中的任务文件、冻结契约和提交为准，不依赖聊天记录。

## 当前交付目标

- 直接编辑第二步创意信息
- 每段 10 秒脚本按用户选择的镜头数生成和编辑
- 最终只展示两张故事板图片和两段对应脚本
- 支持项目批量删除
- 对供应商超时、可能扣费和失败原因给出明确反馈

当前没有未分配的并行开发任务。下一轮由 Codex A 创建独立任务文件和分支，
并在任务中记录 `Route: simple|standard|complex`。

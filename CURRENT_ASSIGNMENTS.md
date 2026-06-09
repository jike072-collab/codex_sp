# 当前并行分工

当前只启用两个开发角色。不要自行认领其他 Track，避免同时改动共享接口。

## Codex A：主线与集成（当前对话）

分支：

```text
main
```

负责：

- `studio-v2/src/workflow-domain/**`
- `studio-v2/src/local-api/**`
- `studio-v2/src/ai-providers/**`
- `studio-v2/src/storage/**`
- `studio-v2/tests/**`
- `prompts/**`
- `schemas/**`
- 跨模块接口契约
- 合并、回归测试与 GitHub 主分支

当前任务：

1. [完成] 定义市场创意数据结构。
2. [完成] 实现 `POST /api/projects/:id/market`。
3. [完成] 定义合法项目状态转换。
4. [完成] 冻结脚本、视觉与导出接口契约。
5. [完成] 实现无 Key 的后端演示闭环。
6. [完成] 检查并集成 Codex B 的前端分支。
7. [完成] 接入 Right Code Gemini 2.5 Flash 识图、DeepSeek V4 Pro 脚本和 Right Code gpt-image-2 图片生成。
8. [完成] 实现项目删除与本地 API Key 设置接口，并集成前端入口。
9. [完成] 拆分识图与生图 API Key 配置，保持三个 provider 独立。
10. [完成] 与前端三接口设置保持一致，识图、脚本和生图 Key 独立保存。
11. [完成] 整合故事版前端闭环，完成存储健壮性审计与浏览器闭环验证。
12. [完成] 收口 Step 02 合并创意设置、脚本镜头数选择、Right Code 生图 403 参考图重试、API Key 职责显示与 Codex B 前端 QA 交接。
13. [完成] 合并第一版闭环，清理旧 `scripts/`、`web/` 原型入口，保留 `studio-v2/8810` 启动方式。

## Codex B：完整闭环前端（另一个 Codex）

分支：

```text
codex/frontend-market-step
```

唯一任务入口：

```text
tasks/codex-frontend-market-step.md
```

允许修改：

- `studio-v2/public/**`

禁止修改：

- `studio-v2/src/**`
- `studio-v2/server.mjs`
- `schemas/**`
- `prompts/**`
- 根目录协作文档

完成后提交到自己的分支，不直接合并 `main`。

当前任务已收口为浏览器 QA/微调：市场创意、脚本编辑、两张故事板最终交付和 JSON 导出。完整接口见：

```text
docs/contracts/market-creative-api.md
docs/contracts/demo-loop-api.md
```

当前前端 follow-up 已变更为 QA/微调：同步 `main`，不要继续旧的 market placeholder 任务，不要重新引入 `rightCodesApiKey`，只在 `studio-v2/public/**` 内核对 Step 02 合并流程、尺寸抽屉、总结弹窗、脚本镜头数选择、进度条和三 Key 设置弹窗。

## 尚未启动

Storage 增强和批量任务暂不分配。

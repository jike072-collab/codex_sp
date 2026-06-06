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
- `schemas/**`
- 跨模块接口契约
- 合并、回归测试与 GitHub 主分支

当前任务：

1. [完成] 定义市场创意数据结构。
2. [完成] 实现 `POST /api/projects/:id/market`。
3. [完成] 定义合法项目状态转换。
4. [进行中] 集成 Codex B 的前端分支。

## Codex B：市场创意前端（另一个 Codex）

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

## 尚未启动

AI Provider、Storage 和 Tests 任务暂不分配。等市场创意步骤合并后再开启，避免第一轮并行范围过大。

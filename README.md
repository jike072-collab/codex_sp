# Shoe Ad Studio

个人使用、本地优先的鞋类广告创意生产工具。

GitHub：`https://github.com/jike072-collab/codex_sp`

## 当前版本

新的模块化版本位于 `studio-v2/`，目前实现：

1. 创建本地项目
2. 上传同一款鞋的多视图图片
3. 调用视觉模型或演示识别
4. 人工编辑产品锁定信息
5. 确认审核并保存项目

启动：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\studio-v2\start.ps1
```

访问 `http://127.0.0.1:8810`。

## 模块

- `studio-v2/public/`：浏览器工作台
- `studio-v2/src/local-api/`：本地 HTTP 接口
- `studio-v2/src/workflow-domain/`：工作流规则与数据标准化
- `studio-v2/src/ai-providers/`：视觉、文本和图片模型适配器
- `studio-v2/src/storage/`：项目与素材持久化
- `studio-v2/tests/`：自动化验证

## 并行开发

协作规则见：

- `docs/ARCHITECTURE.md`
- `docs/PARALLEL-WORK.md`
- `docs/TASKS.md`

每个 Codex 使用独立的 `codex/<task>` 分支，并只修改任务板中归属自己的目录。

## 旧版

根目录下的 `scripts/`、`web/` 和已有 `outputs/` 是已验证的原型与测试参考。新开发默认进入 `studio-v2/`，不要在新旧界面之间同时添加功能。

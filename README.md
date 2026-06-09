# Shoe Ad Studio

个人使用、本地优先的鞋类广告创意生产工具。

GitHub：`https://github.com/jike072-collab/codex_sp`

## 当前版本

新的模块化版本位于 `studio-v2/`，目前实现：

1. 创建本地项目
2. 上传同一款鞋的多视图图片
3. 调用视觉模型或演示识别
4. 人工编辑产品锁定信息
5. 确认产品锁定与市场创意
6. 生成并编辑两段 10 秒脚本
7. 按第二步选择的尺寸生成两张故事板图
8. 下载只包含第一版交付内容的 JSON 包

启动：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\studio-v2\start.ps1
```

访问 `http://127.0.0.1:8810`。

Windows 也可以双击根目录的 `打开鞋类广告工作台.vbs` 启动，使用
`关闭鞋类广告工作台.vbs` 关闭该启动器创建的本地服务。

## 模块

- `studio-v2/public/`：浏览器工作台
- `studio-v2/src/local-api/`：本地 HTTP 接口
- `studio-v2/src/workflow-domain/`：工作流规则与数据标准化
- `studio-v2/src/ai-providers/`：视觉、文本和图片模型适配器
- `studio-v2/src/storage/`：项目与素材持久化
- `studio-v2/tests/`：自动化验证

## 并行开发

当前负责人和另一个 Codex 的唯一任务入口：

- `CURRENT_ASSIGNMENTS.md`
- `tasks/codex-frontend-market-step.md`

协作规则见：

- `docs/ARCHITECTURE.md`
- `docs/PARALLEL-WORK.md`
- `docs/TASKS.md`

每个 Codex 使用独立的 `codex/<task>` 分支，并只修改任务板中归属自己的目录。

## 第一版范围

当前可运行产品只保留 `studio-v2/`。根目录旧版 `scripts/` 和 `web/`
原型已移除，后续不要再向旧入口添加功能。

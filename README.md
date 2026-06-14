# Shoe Ad Studio

个人使用、本地优先的鞋类广告创意生产工具。

GitHub：`https://github.com/jike072-collab/codex_sp`

## 当前版本

新的模块化版本位于 `studio-v2/`。当前第一版面向小白用户的主流程是：

1. 创建本地项目
2. 上传同一款鞋的图片素材
3. 选择 `单版 5-15 秒` 或 `双版 20 秒`
4. 识别并确认产品锁定
5. 确认投放与创意设置
6. 生成并检查广告脚本
7. 生成故事版
8. 生成视频，预览或下载视频结果

普通前台不展示 API Key、供应商、模型、prompt、调试日志或复杂开发配置。

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
- `tasks/codex-backend-current.md`
- `tasks/codex-frontend-current.md`
- `docs/MODEL-ROUTING.md`

协作规则见：

- `docs/ARCHITECTURE.md`
- `docs/PARALLEL-WORK.md`
- `docs/TASKS.md`

每个 Codex 使用独立的 `codex/<task>` 分支，并只修改任务板中归属自己的目录。

## 第一版范围

当前可运行产品只保留 `studio-v2/`。根目录旧版 `scripts/` 和 `web/`
原型已移除，后续不要再向旧入口添加功能。

当前真实产品口径以 `docs/产品口径.md`、`docs/前后端接口契约.md` 和本机
`http://127.0.0.1:8810` 运行结果为准。

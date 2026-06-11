# 当前并行分工

所有 Codex 开始或续接任务前必须依次调用：

1. `$nadirclaw-model-router`
2. `$superpowers-workflow`

开工与交付必须包含：

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: simple|standard|complex
```

任务文件、冻结契约和 GitHub 分支提交优先于聊天记录。

## 任务发布方式

- 本机后端任务：协调端写入任务文件、推送 GitHub 后，同时直接发送到本地后端 Codex 对话执行。
- 另一台电脑前端任务：协调端只通过 GitHub 发布任务文件和任务分支；前端电脑自行 fetch/pull 后开工并直接推送 GitHub。
- 不再为另一台电脑的前端任务寻找或使用本机前端对话。
- 前端交付以 GitHub 分支提交、任务文件状态和回报为准。

## 当前基线

- 正式基线：`f996758`
- 正式分支：`main / v2 / ui-v2`
- 协调端负责发布任务、审核、回归测试与正式分支同步。

## Codex A：后端

状态：READY

任务入口：

- `tasks/codex-backend-current.md`

任务分支：

- `codex/backend-storyboard-524-model-discovery`

负责：

- 定位两张故事板并发时一张成功、一张 `HTTP 524` 的真实原因。
- 保持两张缺失故事板同时发起。
- 增加不泄密的 provider 请求诊断。
- 判断是否真的需要第二个画图接口；只有证据表明当前通道存在单请求/单并发容量限制时，才新增第二画图通道配置。
- 提供 Admin 模型自动发现接口。
- 提供中文 provider schema 和脱敏当前 Key。

只允许修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`

不得修改：

- `studio-v2/public/**`
- `studio-v2/admin/**`

## Codex B：前端

状态：READY

任务入口：

- `tasks/codex-frontend-current.md`

任务分支：

- `codex/frontend-cinematic-workbench`

负责：

- 删除普通工作台左下角供应商状态块。
- Admin 页面完整中文化。
- 修复最右侧内容被裁切与横向溢出。
- 模型改为从后端读取后的下拉选择，不允许自由填空。
- 显示脱敏当前 Key，并保留替换/清除能力。
- 对工作台和 Admin 做一轮最终视觉优化：更统一、更稳定、更像完成品，但不得改变流程或恢复旧导出/API 编辑入口。
- 当前全黑 cinematic 版本不直接合并；保留有用的布局/交互优化，但主工作台和 Admin 需要回到之前更轻、更清楚的浅色工具台视觉。

允许修改：

- `studio-v2/admin/**`
- `studio-v2/public/**`，但只用于本任务明确的侧边栏状态块删除

不得修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`

## 固定产品规则

- 生图只能 img2img，不允许 prompt-only fallback 或降级图。
- 两张缺失故事板应同时发起生成。
- partial success 必须保留成功图片，重试只补缺失图片。
- `HTTP 524` 可能已扣费，不允许未经用户确认自动重试。
- Step 5 只保留两张故事板图片和两段脚本/复制控件。
- 不恢复 JSON、ZIP、CSV、Flow Omni 下载按钮。
- 外层 storyboard sheet 不强行套视频比例；内部 shot frames 按第二步比例构图。
- 浏览器不得读取或显示完整 API Key，只能显示脱敏值。

## 审核要求

协调端合并前必须：

- 检查后端、前端修改范围不重叠。
- 审核 524 诊断证据，不接受无证据猜测。
- 运行全部后端测试。
- 运行全部前端/Admin JS 语法检查。
- 启动本地服务，检查工作台与 `/admin/`。
- 验证模型列表来自真实 provider 能力或明确标记不支持，不得虚构模型。
- 验证页面无横向溢出、完整中文、Key 仅脱敏显示。

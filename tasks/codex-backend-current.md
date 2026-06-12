# Codex A Current Backend Task

Status: READY

Target: 本机后端 Codex 对话

Published: 2026-06-12 Asia/Shanghai

Skills: nadirclaw-model-router, superpowers-workflow

Route: complex

Branch: `codex/backend-single-storyboard-script-quality`

Start from: latest `origin/main` containing this task

## Goal

实现两个可切换的正式功能模式，并修复脚本重复：

1. `single_video`：单段 `5-15` 秒，一条脚本、一张 `full` 故事板、一次生图、一个视频。
2. `legacy_multi_segment`：产品 UI 名称为“双段 20 秒”，固定两个 10 秒脚本段、两张故事板、两次并发生图、两段视频能力。
3. Step 03 模型返回的多个镜头内容几乎完全重复，但当前后端只校验非空和时间连续。两个模式都必须拒绝重复套话。

`legacy_multi_segment` 只是现有持久化兼容值，任何用户可见 schema 文案和错误信息都不得显示“legacy/旧版”。

## Required Backend Work

### A. 冻结模式切换契约

- 更新：
  - `docs/contracts/demo-loop-api.md`
  - `docs/contracts/provider-integration.md`
  - `docs/contracts/video-generation-api.md`
  - `schemas/studio-project.schema.json`
- `project.workflowMode` 继续使用：
  - `single_video`
  - `legacy_multi_segment`
- 新项目默认 `single_video`。
- 增加稳定的模式切换 API，建议：
  - `PUT /api/projects/:id/workflow-mode`
  - body: `{ "workflowMode": "...", "confirmReset": false }`
- 如果项目还没有脚本结果，模式可直接切换并保存。
- 如果已有 `planningPackage`、`imagePackage` 或 `videoPackage`：
  - 未提供 `confirmReset: true` 时返回 `409 WORKFLOW_MODE_RESET_REQUIRED`
  - 返回安全中文提示和将被清除的阶段
  - 确认后原子切换并清除脚本、故事板、视频及其时间戳/失败状态
  - 保留上传素材、识图结果、产品锁定和可复用的市场设置
  - 项目回到 `script` 阶段
- 不允许静默清空生成结果。
- 模式切换后不得残留旧模式故事板计数或视频任务。

### B. 单段模式

- Step 02 使用 `videoDurationSeconds`，整数 `5-15`，默认 `10`。
- 脚本使用 `script_video.segment_full`，时间线完整覆盖选择时长。
- visual package 只创建一个：
  - `segment_id: "full"`
  - `type: "storyboard_board"`
  - `duration_sec`: 选择时长
- `storyboard_plan.total_images === 1`。
- image provider 调用次数严格为 `1`。
- 当前单图明确使用绘图通道 A；不得随机轮换，也不得同时调用通道 B。
- 失败和重试只处理该 `full` item。
- Step 05 只创建一个视频任务。

### C. 双段 20 秒模式

- 固定总时长 `20` 秒。
- 脚本继续保存：
  - `script_20s.segment_a_0_10s`
  - `script_20s.segment_b_10_20s`
- visual package 创建两个 item：
  - `0-10s`
  - `10-20s`
- `storyboard_plan.total_images === 2`。
- 两个缺失故事板必须同时发起：
  - `0-10s` 固定绘图通道 A
  - `10-20s` 固定绘图通道 B
- partial success 保留成功图片。
- 重试只补失败或缺失段。
- Step 05 保留两段视频任务及现有兼容能力。

### D. 两种模式共同规则

- 所有故事板请求都必须携带全部已上传商品参考图。
- 不允许 prompt-only fallback。
- 外层 storyboard sheet 不强套视频比例；内部 shot frame 使用 Step 02 比例。
- 诊断不得包含完整 key、prompt、base64、图片内容或 provider 响应体。

### E. 修复脚本镜头重复

- 修改真实文本模型 prompt，明确要求每个镜头承担不同叙事阶段，例如：
  - 开场识别
  - 材质/细节
  - 动作或使用场景
  - 卖点证明
  - 收束/CTA
- 不得要求每行简单复述产品锁定规则。
- 在后端脚本规范化/确认层增加重复检测：
  - 对每个镜头的 `visual + action + camera` 生成标准化签名。
  - 完全相同的签名不得重复。
  - 如果大多数主要字段只是在重复同一句模板，也必须判定为无效。
- 重复输出不能被保存为已生成或已确认脚本。
- 返回中文可理解错误，例如“模型返回的镜头内容重复，请重新生成脚本”。
- 不做静默付费重试；本轮保持用户手动重新生成。
- demo 模式也必须产生有明显阶段差异的镜头，镜头数超过模板数时不能复制最后一条填满。
- 单段和双段模式都执行相同重复检测。

## Required Tests

- 新项目默认 `single_video`。
- 未生成脚本时切换模式可直接保存。
- 已有脚本/故事板/视频时，未确认切换返回 `409 WORKFLOW_MODE_RESET_REQUIRED`。
- 确认切换后只清除脚本及其下游，保留素材、识图、锁定和共同市场设置。
- 单段模式 visual package 只有一个 `full` item。
- 单段模式 image provider 调用次数严格等于 `1`，且只走通道 A。
- 双段模式 visual package 有两个 item。
- 双段模式两个 provider 请求并发，分别走通道 A/B。
- 请求仍携带商品参考图。
- 单段失败重试只调用一次。
- 双段 partial success 保留成功图，重试只补失败段。
- 模式切换后 readiness、storyboard 数量和 video task 数量正确。
- 完全重复镜头被后端拒绝。
- 高重复度镜头被后端拒绝。
- 合法、内容不同且时间连续的镜头通过。
- demo 脚本镜头不重复。
- 已有 `legacy_multi_segment` 项目自动作为“双段 20 秒”功能读取。
- 全部后端测试通过。
- 所有修改的 MJS 执行 `node --check`。
- `git diff --check` 通过。

## Delivery

完成后提交并推送 `codex/backend-single-storyboard-script-quality`，回报：

- Skills 和 Route
- 提交号
- 契约变化
- 单段一次调用、双段两次并发调用的测试证据
- 脚本重复检测规则
- 修改文件
- 完整测试数
- 确认未修改前端/Admin、未提交密钥或运行数据

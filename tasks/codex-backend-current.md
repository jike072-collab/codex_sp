# Codex A Current Backend Task

Status: READY

Target: 本机后端 Codex 对话

Published: 2026-06-12 Asia/Shanghai

Skills: nadirclaw-model-router, superpowers-workflow

Route: complex

Branch: `codex/backend-single-storyboard-script-quality`

Start from: latest `origin/main` containing this task

## Goal

解决两个 P0 问题：

1. Step 03 模型返回的多个镜头内容几乎完全重复，但当前后端只校验非空和时间连续，导致重复套话被当成合法脚本。
2. 20 秒旧项目仍按 `0-10s / 10-20s` 创建两张故事板和两次生图请求。当前产品要求只生成一张完整 `0-20s` 故事板，并且 provider 只调用一次。

当前可变时长 `single_video` 项目继续生成一张 `full` 故事板，其显示范围为 `0-{videoDurationSeconds}s`。

旧双段能力不能删除，作为 future/legacy 数据兼容能力保留；但当前故事板生成入口不得再触发两张图片。

## Required Backend Work

### A. 冻结单故事板契约

- 更新：
  - `docs/contracts/demo-loop-api.md`
  - `docs/contracts/provider-integration.md`
  - 必要时更新 `docs/contracts/video-generation-api.md`
  - `schemas/studio-project.schema.json`
- 当前故事板交付形态必须是一个 item：
  - `segment_id: "full"`
  - `type: "storyboard_board"`
  - `duration_sec`: 当前完整脚本总时长
  - 20 秒旧脚本对应 `0-20s`
  - 可变时长项目对应 `0-{videoDurationSeconds}s`
- `storyboard_plan.total_images` 必须为 `1`。
- 当前 readiness / export / retry 判断必须按一张图计算。
- 不删除 schema 对旧 `0-10s / 10-20s` 数据的读取兼容。

### B. 合并旧 20 秒脚本用于当前完整故事板

- 如果项目仍保存：
  - `script_20s.segment_a_0_10s`
  - `script_20s.segment_b_10_20s`
- 在故事板生成边界构造一个完整 `full` segment：
  - 时间线从 `0` 连续覆盖到 `20`
  - 保留镜头原始时间和顺序
  - 不丢失画面、动作、镜头、卖点、口播/字幕、音效、转场
- 不要求破坏性迁移或删除原始 `script_20s`。
- 已存在的两张旧故事板数据可以保留为历史兼容数据，但不能再被当前生成状态、完成数量或当前交付选中。

### C. 故事板 provider 只调用一次

- `generateVisualPackage` 当前路径只创建一个 `full` storyboard item。
- `generateProjectImages` 或等价执行链只向 provider 发起一次 img2img 请求。
- 请求必须继续携带全部已上传商品参考图。
- 不允许 prompt-only fallback。
- 失败后重试只重试这一张 `full` 故事板。
- 诊断继续记录安全摘要，但不得包含完整 key、prompt、base64、图片内容或 provider 响应体。
- 双 key / 双通道实现保留在代码中，但当前单故事板只选择一个明确通道。必须在契约中写清当前通道选择规则，不能随机轮换。

### D. 修复脚本镜头重复

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

### E. 兼容与下游

- 当前视频生成读取一张 `full` 故事板。
- 不允许因为旧项目脚本仍是 `script_20s` 就再次要求两张故事板。
- 旧双段底层函数、旧数据解析和历史测试保留，但必须与“当前生成策略”分开，避免旧数据自动切回双故事板 UI。

## Required Tests

- 20 秒 `script_20s` 生成 visual package 后只有一个 `full` storyboard item。
- 单故事板 prompt 覆盖完整 `0-20s` 镜头。
- image provider 在当前 20 秒项目中调用次数严格等于 `1`。
- 请求仍携带商品参考图。
- 单图失败只产生一个失败项；重试只调用一次并补该图。
- 已存在旧双故事板不会被计入当前 `1/1` readiness。
- 可变时长项目仍产生一个 `full` storyboard，duration 正确。
- 完全重复镜头被后端拒绝。
- 高重复度镜头被后端拒绝。
- 合法、内容不同且时间连续的镜头通过。
- demo 脚本镜头不重复。
- 旧双段数据仍可读取，旧能力代码未删除。
- 全部后端测试通过。
- 所有修改的 MJS 执行 `node --check`。
- `git diff --check` 通过。

## Delivery

完成后提交并推送 `codex/backend-single-storyboard-script-quality`，回报：

- Skills 和 Route
- 提交号
- 契约变化
- 单次 provider 调用的测试证据
- 脚本重复检测规则
- 修改文件
- 完整测试数
- 确认未修改前端/Admin、未提交密钥或运行数据

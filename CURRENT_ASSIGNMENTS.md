# 当前并行分工

所有 Codex 开工前必须依次调用：

1. `$nadirclaw-model-router`
2. `$superpowers-workflow`

任务回报必须包含：

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## 唯一任务入口

所有电脑都先 fetch，再只读取 GitHub 上的：

1. `origin/main:CURRENT_ASSIGNMENTS.md`
2. `origin/main:tasks/README.md`
3. 当前角色任务文件
   - 后端：`origin/main:tasks/codex-backend-current.md`
   - 前端：`origin/main:tasks/codex-frontend-current.md`

聊天记录、截图、旧分支和本地旧任务文件都不是开工依据。

## 当前基线

- 正式基线：`origin/main` 最新提交，至少包含 `1fc7930`
- 正式分支：`main / v2 / ui-v2`
- 协调端：发布任务、审核提交、合并、回归、同步正式分支
- 本机后端：只改后端、契约、schema 和测试
- 另一台电脑前端：只改 `studio-v2/public/**`

## 本轮产品决定

左上角原“故事板”标签改为项目功能切换，两个模式正式并列：

- `单段 5-15 秒`
  - 数据模式：`single_video`
  - Step 02 选择 `5-15` 秒
  - 一条完整脚本时间线
  - 一张 `full` 故事板
  - 一次 img2img provider 调用
  - 一个视频任务
- `双段 20 秒`
  - 现有兼容数据模式：`legacy_multi_segment`
  - UI 不显示“legacy/旧版”等技术名称
  - 固定 `0-10s + 10-20s`
  - 两个脚本段
  - 两张故事板
  - 两条绘图通道并发调用
  - 保留 partial success 和只补失败段

两个模式使用相同五步流程，只在 Step 02 时长设置、Step 03 脚本分段、Step 04 故事板数量和 Step 05 视频任务数量上不同。

模式必须保存在项目中。已有脚本、故事板或视频的项目切换模式时，必须明确提示会清空脚本之后的结果并二次确认；不得静默丢失数据。

脚本镜头不允许只改时间、其余字段整行重复。两个模式都必须经过后端镜头内容差异校验。

## Codex A：本机后端

状态：READY

任务文件：

- `tasks/codex-backend-current.md`

任务分支：

- `codex/backend-single-storyboard-script-quality`

允许修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`

禁止修改：

- `studio-v2/public/**`
- `studio-v2/admin/**`
- `.env`
- `studio-v2/data/**`
- 上传、生成、日志和 PID 文件

## Codex B：另一台电脑前端

状态：WAITING FOR BACKEND CONTRACT

任务文件：

- `tasks/codex-frontend-current.md`

任务分支：

- `codex/frontend-single-storyboard-script-view`

允许修改：

- `studio-v2/public/**`

禁止修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`
- `studio-v2/admin/**`

前端必须先看到后端分支的模式切换契约与交付提交，再开始依赖接口形状的实现；可以先读取任务，不得猜字段。

## 固定产品规则

- 生图只能 img2img，必须携带已上传商品参考图。
- 不允许 prompt-only fallback，不允许降级生图。
- 单段模式只发起一次故事板生成请求。
- 双段模式同时发起两次故事板生成请求。
- 生成成功图保存在本地项目中。
- API Key 只能保存在本地设置，页面只显示 masked preview。
- 不恢复 JSON / ZIP / CSV / Flow Omni 下载按钮。
- 外层 storyboard sheet 不强行套视频比例；内部 shot frame 按第二步选择比例构图。
- 不做消费、余额、扣费、支付、价格展示或用量统计。

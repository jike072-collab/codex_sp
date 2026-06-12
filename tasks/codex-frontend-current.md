# Codex B Current Frontend Task

Status: READY - WAIT FOR REVISED SINGLE-VIDEO CONTRACT, THEN START

Target: 另一台前端电脑

Published: 2026-06-12 Asia/Shanghai

Route: complex

Branch: `codex/frontend-video-generation-step`

Start from: latest `origin/main`

Backend dependency branch: `codex/backend-video-generation-provider`

## Required Skills

Start every task or resumed task with:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## Goal

把当前默认流程调整为“一个脚本、一张故事板、一个视频”。Step 02 选择 `5-15` 秒视频时长，后续脚本、故事板和视频都跟随这一时长。

本轮是功能完善，不接消费系统。

原来的双段脚本和双故事板渲染能力不得删除。旧项目仍需可查看，未来可能重新启用多段模式；新项目和当前界面默认使用 `single_video`。

## Frontend Work

1. Step 02 视频时长：
   - 增加视频时长控件，范围 `5-15` 秒，默认 `10` 秒。
   - 使用适合有限数值选择的控件，可用滑杆配数值显示或下拉选择，不使用自由文本。
   - 当前值必须清楚显示为“5 秒”到“15 秒”。
   - 保存到后端冻结契约中的 `videoDurationSeconds`。
   - 当前单视频模式不再让用户手工选择“每段镜头数”；镜头数量由脚本根据时长自动决定。
2. Stepper 和文案：
   - Step 05 名称改为“生成视频”。
   - 副标题改为“最终广告视频”或同等中文。
   - 工作台不再把 Step 05 叫“导出”。
3. Step 03 单脚本：
   - 当前模式只显示一条完整脚本时间线。
   - 标题显示所选时长，例如“10 秒广告脚本”。
   - 表格中的所有镜头合计必须覆盖 `0` 到所选时长。
   - 不再把当前模式拆成 `0-10s` 和 `10-20s` 两块。
   - legacy 双段项目仍使用原双段展示，不删除旧渲染函数。
4. Step 04 单故事板：
   - 当前模式只显示一张故事板卡片。
   - 卡片显示所选时长、比例和镜头数。
   - 生成、失败、重试都只针对这一张。
   - legacy 双故事板项目继续按原方式显示。
5. Step 05 页面结构：
   - 顶部显示最终视频总状态。
   - 只显示一个视频生成区域。
   - 显示所选时长、对应故事板缩略图、脚本摘要、状态、生成/重试按钮、播放器和下载按钮。
   - 不显示“两段视频”或“最终合成”区域。
6. 状态展示：
   - `waiting`：等待生成
   - `submitting`：正在提交任务
   - `queued`：排队中
   - `generating`：生成中
   - `downloading`：正在取回视频
   - `done`：生成完成
   - `failed`：生成失败
7. API 消费：
   - 以后端 `docs/contracts/video-generation-api.md` 为准。
   - 支持开始生成、查询状态、失败段重试、单段下载、最终视频下载。
   - 当前模式只操作一个视频任务。
   - legacy 双段项目仍要能显示原有 partial success。
8. Admin 页面：
   - 增加“视频生成”配置卡片。
   - 支持 API URL、Model、API Key。
   - 模型可从后端 schema 或模型接口读取。
   - 只显示 masked key preview，不显示完整 key。
9. 视觉要求：
   - 保持和当前主工作台风格统一。
   - 中文界面。
   - 不显示技术错误堆栈。
   - 不横向滚动，不裁切右侧。
   - 视频区域尺寸稳定，播放器不挤压文字。

## Explicitly Out Of Scope

本轮不要做：

- 用户余额
- 扣费
- 支付
- 消费记录
- 价格计算
- 套餐、分组、额度
- 用量统计仪表盘
- 主工作台显示单次价格
- Flow 网页登录自动化
- Gemini Omni 网页自动化
- sub2api 集成
- JSON / ZIP / CSV / Flow Omni 下载按钮

## Scope

Allowed:

- `studio-v2/public/**`
- `studio-v2/admin/**`

Do not edit:

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`
- root coordination files
- `.env`、API Key、运行数据、上传图片、生成结果、日志或 PID 文件

## Coordination

- 前端先等待后端修订后的单视频契约提交到 `codex/backend-video-generation-provider`。
- 契约冻结后，从后端分支或主线读取 `docs/contracts/video-generation-api.md`。
- 如果后端接口字段不清楚，停止并要求协调端冻结契约，不要猜字段。

## Required Verification

1. 对所有 `studio-v2/public/js/*.js` 和 `studio-v2/admin/*.js` 执行语法检查。
2. 浏览器验证 Step 05：
   - Step 02 可选择 `5`、`10`、`15` 秒并正确保存。
   - Step 03 只显示一条符合所选时长的脚本。
   - Step 04 只显示一张故事板。
   - 一张故事板完成后进入“生成视频”。
   - 点击开始生成后显示单个视频状态。
   - 失败后可重试，成功后可播放和下载。
   - 打开 legacy 双段项目时，旧脚本和故事板仍能查看。
3. 浏览器验证 Admin：
   - 能看到“视频生成”配置卡片。
   - 能保存 API URL、Model、API Key。
   - Key 只显示 masked preview。
4. 提供 Step 05 和 Admin 视频配置截图。

## Delivery

Push `codex/frontend-video-generation-step` and report:

- Skills and route
- Commit hash
- Changed files
- JS checks
- Browser verification results
- Screenshots
- Confirmation that no backend files or secrets were changed

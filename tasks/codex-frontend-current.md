# Codex B Current Frontend Task

Status: READY - WAIT FOR BACKEND CONTRACT, THEN START

Target: 另一台前端电脑

Published: 2026-06-12 Asia/Shanghai

Route: complex

Branch: `codex/frontend-video-generation-step`

Start from: latest `origin/main` at or after `64bf753`

Backend dependency branch: `codex/backend-video-generation-provider`

## Required Skills

Start every task or resumed task with:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## Goal

把 Step 05 从“导出”重新设计为“生成视频”。前面生成的两段脚本和两张故事板进入最后一步后，用户能生成两段视频，查看状态，播放结果，下载视频，并对失败段单独重试。

本轮是功能完善，不接消费系统。

## Frontend Work

1. Stepper 和文案：
   - Step 05 名称改为“生成视频”。
   - 副标题改为“最终广告视频”或同等中文。
   - 工作台不再把 Step 05 叫“导出”。
2. Step 05 页面结构：
   - 顶部显示最终视频总状态。
   - 中间显示两段视频卡片：
     - `0-10s`
     - `10-20s`
   - 每张卡片显示：
     - 段落标题
     - 对应故事板缩略图
     - 脚本摘要
     - 当前状态
     - 生成按钮或重试按钮
     - 视频播放器
     - 下载按钮
   - 底部显示最终合成视频区域；如果后端未合并，显示“两段视频已完成，可分别下载”。
3. 状态展示：
   - `waiting`：等待生成
   - `submitting`：正在提交任务
   - `queued`：排队中
   - `generating`：生成中
   - `downloading`：正在取回视频
   - `done`：生成完成
   - `failed`：生成失败
4. API 消费：
   - 以后端 `docs/contracts/video-generation-api.md` 为准。
   - 支持开始生成、查询状态、失败段重试、单段下载、最终视频下载。
   - partial success 必须可见：一段成功、一段失败时，成功段仍能播放和下载。
5. Admin 页面：
   - 增加“视频生成”配置卡片。
   - 支持 API URL、Model、API Key。
   - 模型可从后端 schema 或模型接口读取。
   - 只显示 masked key preview，不显示完整 key。
6. 视觉要求：
   - 保持和当前主工作台风格统一。
   - 中文界面。
   - 不显示技术错误堆栈。
   - 不横向滚动，不裁切右侧。
   - 视频卡片尺寸稳定，播放器不挤压文字。

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

- 前端先等待后端契约提交到 `codex/backend-video-generation-provider`。
- 契约冻结后，从后端分支或主线读取 `docs/contracts/video-generation-api.md`。
- 如果后端接口字段不清楚，停止并要求协调端冻结契约，不要猜字段。

## Required Verification

1. 对所有 `studio-v2/public/js/*.js` 和 `studio-v2/admin/*.js` 执行语法检查。
2. 浏览器验证 Step 05：
   - 两张故事板完成后进入“生成视频”。
   - 点击开始生成后两段卡片分别显示状态。
   - mock 或真实接口下，一段失败、一段成功时，成功段仍可播放/下载。
   - 失败段可单独重试。
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

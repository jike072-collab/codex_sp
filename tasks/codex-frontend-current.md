# Codex B Current Frontend Task

Status: DONE - REVIEWED AND MERGED

Target: 另一台前端电脑

Published: 2026-06-12 Asia/Shanghai

Route: complex

Branch: `codex/frontend-video-generation-step`

Start from: latest `origin/main` at or after `4cac041`

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
   - API Key 是视频生成专用 Key，不得和识图、脚本、生图 Key 混用。
   - Key 输入框使用密码输入样式；未输入新值时保留当前 Key。
   - 显示当前 Key 的 masked preview，只显示安全尾号。
   - 支持“替换视频 Key”和“清除已保存 Key”。
   - 保存成功后刷新配置状态，明确显示“视频生成已配置”。
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

## Do Not Start Until

前端在看到以下条件全部满足前，不得开始改代码：

1. 后端 `codex/backend-video-generation-provider` 已推送新提交，且不是旧的 `c930526` 两段视频版本。
2. 后端交付说明明确写了：
   - `workflowMode` 或等价字段如何表示 `single_video`。
   - `videoDurationSeconds` 存在位置、默认值和允许范围。
   - 单脚本数据结构。
   - 单故事板数据结构。
   - 单视频任务数据结构。
   - Admin `video` provider 字段名和保存 payload。
3. `docs/contracts/video-generation-api.md` 已更新为单视频默认契约。
4. 协调端确认后端测试通过，并允许前端开工。

如果任何一项不满足，前端只允许回报“等待后端契约”，不要基于旧接口猜实现。

## Detailed Implementation Checklist

开工后按下面清单逐项完成，不能只改 Step 05：

### A. Contract Intake

- 读取 `docs/contracts/video-generation-api.md`。
- 读取后端 `/api/admin/providers` 的 `video` provider schema。
- 读取后端 `/api/admin/providers/models` 的 video 模型返回。
- 在前端 API helper 中集中封装视频接口，不要把 URL 字符串散在多个渲染函数里。
- 如果字段名和本任务不同，以后端契约为准，并在交付说明里写出映射。

### B. Step 02 Duration Control

- 在产品设定/创意设置区域加入“视频时长”。
- 控件必须是 5-15 秒的有限选择，不允许用户输入任意文本。
- 默认 10 秒。
- 变更后即时更新摘要区域和右侧状态。
- 提交 review / market brief 时必须带上 `videoDurationSeconds`。
- 用户回到 Step 02 时要能看到已保存的时长。
- 不再显示当前模式的“每段镜头数”选择；legacy 项目可保留旧显示。

### C. Step 03 Single Script View

- 当前 `single_video` 模式只显示一条脚本时间线。
- 标题、状态面板和操作按钮都使用所选时长，例如“12 秒广告脚本”。
- 镜头表格按时间顺序展示，不拆成 A/B 两段。
- 表格列建议包括：时间、镜头、画面、动作、旁白/字幕、转场。
- 如果脚本可编辑，编辑后仍要校验时间线完整覆盖所选时长。
- legacy 双段项目继续走旧的双段展示。

### D. Step 04 Single Storyboard View

- 当前 `single_video` 模式只显示一个故事板生成卡片。
- 卡片显示：故事板标题、时长、比例、镜头数、状态、缩略图/占位。
- 生成中只出现一个任务状态，不显示 1/2 或 2/2。
- 失败后只重试这一张故事板。
- legacy 双故事板项目继续走旧的两张卡片显示。

### E. Step 05 Single Video View

- Stepper 文案改成“生成视频 / 最终广告视频”。
- 页面只展示一个视频生成任务。
- 生成前显示输入摘要：
  - 视频时长
  - 输出比例
  - 故事板缩略图
  - 脚本摘要
- 生成状态必须映射为中文：
  - `waiting`：等待生成
  - `submitting`：正在提交任务
  - `queued`：排队中
  - `generating`：生成中
  - `downloading`：正在取回视频
  - `done`：生成完成
  - `failed`：生成失败
- 完成后展示 `<video controls>` 播放器。
- 下载按钮下载当前单视频。
- 失败时显示中文原因和“重新生成视频”按钮。
- 不显示“两段视频”“最终合成”“0-10s”“10-20s”等旧文案。
- legacy 双段项目可保留旧双段视频状态显示，但不要影响新项目默认体验。

### F. Admin Video Provider

- Admin 增加“视频生成”配置卡片。
- 字段包括：
  - API URL
  - Model
  - API Key
  - 当前 Key 脱敏预览
  - 清除已保存 Key
- API Key 是 `VIDEO_MODEL_API_KEY`，不能复用其他 provider Key。
- 未输入新 Key 保存时，应保留旧 Key。
- 输入新 Key 保存后，预览应刷新。
- 勾选清除 Key 保存后，状态变为未配置。
- 模型下拉/选择器读取后端 video 模型列表；模型接口失败时要有中文提示。

### G. Empty / Loading / Error States

- 未生成脚本时，Step 04 / Step 05 要给出中文阻断说明。
- 未生成故事板时，Step 05 要提示先完成故事板。
- 视频 provider 未配置时，Step 05 要提示去后台配置视频生成 Key。
- 生成中使用稳定尺寸的 loading / skeleton，不要假百分比乱跳。
- 所有错误都显示中文人话，不展示堆栈、JSON 或 provider 原始响应。

### H. Compatibility

- 不删除 legacy 双段渲染函数。
- 不删除旧项目读取能力。
- 新项目默认走 `single_video`。
- 如果项目没有 `workflowMode` 但已有两个故事板或两个脚本段，按 legacy 显示。
- 如果项目没有 `videoDurationSeconds`，默认显示 10 秒，但保存时补齐。

## Required Verification

1. 对所有 `studio-v2/public/js/*.js` 和 `studio-v2/admin/*.js` 执行语法检查。
2. 浏览器验证新项目单视频流程：
   - Step 02 可选择 `5`、`10`、`15` 秒并正确保存。
   - Step 03 只显示一条符合所选时长的脚本。
   - Step 04 只显示一张故事板。
   - 一张故事板完成后进入“生成视频”。
   - 点击开始生成后显示单个视频状态。
   - 失败后可重试，成功后可播放和下载。
3. 浏览器验证 legacy 兼容：
   - 打开 legacy 双段项目时，旧脚本和故事板仍能查看。
   - legacy 项目不被强制改成单视频。
4. 浏览器验证 Admin：
   - 能看到“视频生成”配置卡片。
   - 能保存 API URL、Model、API Key。
   - Key 只显示 masked preview。
   - 替换 Key 后 masked preview 更新；清除后状态变为未配置。
5. 视口检查：
   - 桌面宽屏无横向滚动。
   - 常见笔记本宽度右侧不裁切。
   - 视频播放器、按钮、状态文案不重叠。
6. 提供截图：
   - Step 02 视频时长控件。
   - Step 03 单脚本。
   - Step 04 单故事板。
   - Step 05 单视频生成/完成状态。
   - Admin 视频配置卡片。

## Delivery

Push `codex/frontend-video-generation-step` and report:

- Skills and route
- Commit hash
- Changed files
- JS checks
- Browser verification results
- Screenshots
- Confirmation that no backend files or secrets were changed

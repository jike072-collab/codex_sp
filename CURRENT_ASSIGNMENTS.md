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

## 任务读取唯一入口

所有电脑、所有 Codex 对话都只从 GitHub 仓库读取任务，不以聊天记录、截图或本地旧文件为准。

开工前固定读取顺序：

1. `CURRENT_ASSIGNMENTS.md`：确认自己是后端、前端还是协调端。
2. `tasks/README.md`：确认任务文件、分支、提交和回报规则。
3. 自己角色的当前任务文件：
   - 后端：`tasks/codex-backend-current.md`
   - 前端：`tasks/codex-frontend-current.md`
4. 对应任务分支的最新提交。

如果聊天里说了新任务，但 GitHub 上这三个文件还没更新，视为任务未正式发布，不开工；提醒协调端先发布任务文件。

## 任务发布方式

- 本机后端任务：协调端写入任务文件，并直接发到本地后端 Codex 对话。
- 另一台电脑前端任务：协调端只通过任务文件和 GitHub 分支发布；前端机自行 fetch/pull 后直接推送 GitHub。
- 另一台电脑的前端任务不走本机对话，本机只做后端、协调和审核。
- 前端交付以 GitHub 分支、任务文件状态和回报为准。

协调端发布新任务必须同时完成：

1. 更新 `CURRENT_ASSIGNMENTS.md` 的状态、任务入口和任务分支。
2. 更新对应 `tasks/codex-*-current.md`。
3. 必要时更新 `tasks/README.md`。
4. 提交并推送到 `main / v2 / ui-v2`。
5. 创建或更新对应任务分支。
6. 本机后端任务再额外发送到本地后端对话；前端任务不发送到本机前端对话。

前端电脑找任务时只认：

- `origin/main:CURRENT_ASSIGNMENTS.md`
- `origin/main:tasks/README.md`
- `origin/main:tasks/codex-frontend-current.md`
- `origin/codex/frontend-*:tasks/codex-frontend-current.md`

前端如果找不到任务，先执行 fetch，再看 `origin/main` 上的上述文件；不要从旧分支、旧工作区或聊天摘要里找。

## 当前基线

- 正式基线：`64bf753`
- 正式分支：`main / v2 / ui-v2`
- 协调端负责发布任务、审查、回归测试与正式分支同步。

## 本轮产品目标

完善功能优先：当前默认流程改成“一个脚本、一张故事板、一个视频”。

- Step 02 选择视频时长，范围 `5-15` 秒，默认 `10` 秒。
- Step 03 根据所选时长自动生成一条完整时间线脚本和对应分镜。
- Step 04 根据这一条脚本生成一张故事板。
- Step 05 使用该脚本和故事板生成一个视频。
- 视频 provider 必须收到明确的时长字段；平台按秒计费，但本项目不实现消费或价格系统。

原来的“两段脚本、两张故事板、双绘图通道”能力不得删除。它作为 legacy / future multi-segment 模式保留，旧项目仍可读取，未来可以重新启用；新项目和当前 UI 默认使用 `single_video` 模式。

本轮明确不做：

- 用户余额
- 扣费
- 支付
- 消费记录
- 价格计算
- 套餐、分组、额度
- 用量统计仪表盘
- 主工作台价格展示

价格只作为内部选型参考，不进入产品界面。

## Codex A：本机后端

状态：CHANGES REQUESTED - REVISE `c930526`

任务入口：

- `tasks/codex-backend-current.md`

任务分支：

- `codex/backend-video-generation-provider`

负责内容：

- 冻结视频生成契约。
- 新增视频生成 provider，默认接 `clmm-mall.top` 的 `seedance2.0 720p-fast`。
- 在现有 `c930526` 视频 provider 基础上改为默认单视频模式。
- 新项目保存 `5-15` 秒视频时长，并据此生成一个脚本、一张故事板和一个视频。
- 保存生成结果，支持状态查询、失败重试和下载。
- 保留旧双段脚本、双故事板和双视频数据兼容，不删除旧能力。
- 后台 provider schema 增加视频生成配置，但不做消费、余额或价格系统。

允许修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`

禁止修改：

- `studio-v2/public/**`
- `studio-v2/admin/**`

## Codex B：另一台电脑前端

状态：READY - WAIT FOR REVISED SINGLE-VIDEO CONTRACT, THEN START

任务入口：

- `tasks/codex-frontend-current.md`

任务分支：

- `codex/frontend-video-generation-step`

负责内容：

- Step 02 增加 `5-15` 秒视频时长设置。
- Step 03 当前模式只显示一条完整时长脚本。
- Step 04 当前模式只显示一张故事板。
- Step 05 改为单个“生成视频”界面，显示状态、播放、下载和重试。
- Admin 页面增加“视频生成配置”卡片。
- 不做消费、余额、支付、价格展示。
- 旧双段项目仍要能查看，不删除 legacy 渲染能力。

允许修改：

- `studio-v2/public/**`
- `studio-v2/admin/**`

禁止修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`

## 固定产品规则

- 生图只能 img2img，不允许 prompt-only fallback。
- 当前 `single_video` 模式只生成一张故事板。
- legacy 双段模式的两张故事板仍必须同时发起；成功图保留，重试只补缺失。
- 当前新项目默认 `single_video`，只生成一个视频。
- 原双段模式不得删除；legacy 双段模式仍保留 partial success 和只补失败段能力。
- 最终视频功能优先，不恢复 JSON / ZIP / CSV / Flow Omni 下载按钮。
- 外层 storyboard sheet 不强行套视频比例；内部 shot frames 才按第二步比例构图。
- Step 01 最少 1 个图片文件即可识别；单个文件允许包含多角度拼图。

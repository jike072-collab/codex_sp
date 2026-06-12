# Codex B Current Frontend Task

Status: DONE - MERGED INTO MAIN

Target: 另一台电脑前端 Codex

Published: 2026-06-12 Asia/Shanghai

Skills: nadirclaw-model-router, superpowers-workflow

Route: complex

Branch: `codex/frontend-single-storyboard-script-view`

Start from: latest `origin/main` containing this task

Backend dependency commit: `8667638` (approved and merged into `origin/main`)

Frontend implementation commit: `5714689`

## Backend Contract Approved

后端提交 `8667638` 已推送、审核并冻结以下契约：

- 模式切换 API 的 route、payload、成功响应和 `409 WORKFLOW_MODE_RESET_REQUIRED`。
- `single_video` 返回一个 `full` 故事板和一个视频任务。
- `legacy_multi_segment` 返回两个 10 秒故事板和两段视频任务。
- 切换模式后的数据清理范围与项目返回阶段。

请先 fetch，并从包含 `8667638` 的最新 `origin/main` 开始实现；不得根据旧双段接口猜字段。

## Goal

把截图左上角原来的“故事板”状态标签改为功能模式切换：

- `单段 5-15 秒`
- `双段 20 秒`

两个模式共用相同五步流程。页面只在时长设置、脚本分段、故事板数量和视频数量上切换，不建立两套工作台。

## Required Frontend Work

### A. 左上角模式切换

- 在截图箭头位置使用稳定尺寸的 segmented control，不使用自由文本输入。
- 两个选项：
  - `单段 5-15 秒`
  - `双段 20 秒`
- 当前选项清晰高亮，字号必须可读。
- 不显示 `single_video`、`legacy_multi_segment`、legacy、旧版等技术文字。
- 切换调用后端模式 API并持久化到项目。
- 切换不会清数据时直接完成。
- 后端返回 `WORKFLOW_MODE_RESET_REQUIRED` 时弹出中文确认对话框，明确说明：
  - 上传素材和产品锁定会保留
  - 脚本、故事板和视频会清除
- 用户取消时保持原模式。
- 确认切换成功后重新渲染项目并回到 Step 03。
- 切换控件宽度固定，不能造成顶部、stepper 或页面上下跳动。

### B. Step 02 模式差异

- 单段模式：
  - 显示 `5-15` 秒时长选择
  - 不显示“每段镜头数”
- 双段模式：
  - 明确显示固定总时长 `20 秒（2 × 10 秒）`
  - 可继续显示现有每段镜头数设置
- 国家、人群、比例、主题、语气和主张等共同设置保持一致。

### C. Step 03 脚本

- 单段模式渲染一张完整时长表格。
- 双段模式仍使用同一表格组件，但在 `10s` 位置显示清晰分段标识；也可显示两个紧邻表格区块，不能重复镜头。
- 每个镜头只渲染一次。
- 表头继续包含：
  - 时间
  - 画面
  - 动作
  - 镜头
  - 卖点
  - 口播/字幕
  - 音效
  - 转场
- 不在前端制造或填充重复默认文案；只显示后端真实内容。
- 字号和行高必须保证中文可读，不能像截图一样挤成一团。

### D. Step 04 故事板

- 单段模式：
  - `storyboardSegmentIds` 返回 `full`
  - 计数 `0/1`、`1/1`
  - 一张完整时长卡片
  - 一个错误/重试/下载入口
- 双段模式：
  - 返回 `0-10s`、`10-20s`
  - 计数 `0/2`、`1/2`、`2/2`
  - 显示两张卡片
  - 成功图保留，重试只补失败卡片
- 必须由项目 `workflowMode` 选择真实 DOM 和动作，不能只用 CSS 隐藏。
- 图片按真实比例完整显示。

### E. Step 05 视频

- 单段模式显示一个故事板输入、一个视频任务。
- 双段模式显示两个故事板输入、两个视频任务，并沿用现有 partial success。
- 两种模式使用同一 Step 05 页面骨架。

### F. 兼容和视觉

- 旧 `legacy_multi_segment` 项目在 UI 中显示为“双段 20 秒”。
- 所有可见文字保持中文。
- 桌面和常见笔记本宽度不能横向溢出。
- 表格内容允许换行，不允许文字互相覆盖。
- 故事板图片完整显示，使用真实图片比例，不强塞进横向裁切框。

## Required Verification

- 所有 `studio-v2/public/js/*.js` 执行 `node --check`。
- `git diff --check` 通过。
- 浏览器验证左上角 segmented control 不跳动、不裁切。
- 验证无下游结果时可直接双向切换。
- 验证已有脚本时出现重置确认；取消不改变项目，确认后清除脚本下游并切换。
- 单段模式：
  - Step 02 显示 5-15 秒
  - Step 03 一条完整脚本
  - Step 04 一张卡片和 `0/1`
  - Step 05 一个视频任务
- 双段模式：
  - Step 02 显示固定 20 秒
  - Step 03 两段脚本内容且不重复渲染
  - Step 04 两张卡片和 `0/2`
  - Step 05 两段视频任务
- 提供模式切换、单段 Step 04、双段 Step 04 截图。

## Delivery

完成后提交并推送 `codex/frontend-single-storyboard-script-view`，回报：

- Skills 和 Route
- 后端依赖提交号
- 前端提交号
- 修改文件
- JS 语法检查结果
- 浏览器验证结果和截图
- 确认没有修改后端、Admin、契约、schema、密钥或运行数据

# Codex B Current Frontend Task

Status: WAITING FOR BACKEND CONTRACT

Target: 另一台电脑前端 Codex

Published: 2026-06-12 Asia/Shanghai

Skills: nadirclaw-model-router, superpowers-workflow

Route: complex

Branch: `codex/frontend-single-storyboard-script-view`

Start from: latest `origin/main` containing this task

Backend dependency: `codex/backend-single-storyboard-script-quality`

## Do Not Start Until

后端分支必须先推送并明确：

- 当前故事板返回一个 `segment_id: "full"` item。
- 20 秒旧脚本对应一个 `0-20s` 故事板。
- `storyboard_plan.total_images === 1`。
- 当前生成只调用一次图片 provider。
- readiness / retry / video input 都按该 `full` 故事板处理。

在这些字段冻结前，不得根据旧双段接口猜实现。

## Goal

1. Step 03 只展示一条完整时间线，脚本内容必须清楚可读，不能再出现两块重复段落或一张镜头重复渲染。
2. Step 04 当前界面只显示一张完整故事板：
   - 20 秒旧项目显示 `0-20s`
   - 可变时长项目显示 `0-{videoDurationSeconds}s`
3. 当前界面不再显示 `0-10s / 10-20s` 两张故事板卡片。

旧双段渲染函数可以保留，但当前入口不得再选择它。

## Required Frontend Work

### A. Step 03 完整脚本表格

- 对后端新的完整脚本结构渲染一张表格。
- 如果后端保留旧 `script_20s` 数据但当前策略为单故事板，前端把两段镜头按时间顺序显示在同一张 `0-20s` 表格中。
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

### B. Step 04 单故事板

- 当前 `storyboardSegmentIds` 或等价选择逻辑只返回 `full`。
- 计数显示 `0/1`、`1/1`，不能再显示 `0/2`。
- 只渲染一张卡片：
  - 标签 `0-20s` 或当前完整时长
  - 一张图片/一个占位
  - 一个状态
  - 一个错误提示
  - 一个重试按钮
- 删除当前界面里的两个 10 秒卡片，不允许只用 CSS 隐藏后仍在 DOM 或仍触发两次请求。
- 失败文案改成“该完整故事板尚无图片，重试只生成这一张”。
- 完成后只显示一个下载图片按钮。

### C. Step 05 输入摘要

- 视频生成摘要只选择 `full` 故事板。
- 不再从当前界面选择 `0-10s` 或 `10-20s` 作为视频参考图。
- 20 秒旧项目显示一个完整故事板缩略图。

### D. 兼容和视觉

- 保留旧双段渲染函数，供 future/legacy 专用入口使用，但当前产品入口不调用。
- 所有可见文字保持中文。
- 桌面和常见笔记本宽度不能横向溢出。
- 表格内容允许换行，不允许文字互相覆盖。
- 故事板图片完整显示，使用真实图片比例，不强塞进横向裁切框。

## Required Verification

- 所有 `studio-v2/public/js/*.js` 执行 `node --check`。
- `git diff --check` 通过。
- 浏览器验证 20 秒项目：
  - Step 03 一张 `0-20s` 表格。
  - 每个镜头只出现一次。
  - Step 04 只出现一个 `0-20s` 故事板卡片。
  - 状态计数为 `0/1` 或 `1/1`。
  - 点击重试只发一个生成动作。
- 浏览器验证可变时长项目：
  - 只出现一个完整时长故事板卡片。
- Step 05 只显示一个故事板输入缩略图。
- 提供 Step 03、Step 04、Step 05 截图。

## Delivery

完成后提交并推送 `codex/frontend-single-storyboard-script-view`，回报：

- Skills 和 Route
- 后端依赖提交号
- 前端提交号
- 修改文件
- JS 语法检查结果
- 浏览器验证结果和截图
- 确认没有修改后端、Admin、契约、schema、密钥或运行数据

# DeepSeek Frontend Code Task

Status: READY - START NOW

Target: DeepSeek web / desktop code editor

Published: 2026-06-12 Asia/Shanghai

Route: complex

Branch: `deepseek/frontend-workflow-mode-code`

Start from: latest `origin/main` containing commit `c1de237`

## Role Constraints

- 只做代码编辑，不做截图、识图或浏览器视觉验收。
- 只读 GitHub 上的任务文件和正式分支，不依赖聊天记录。
- 不改后端契约、`docs/contracts/**`、`schemas/**`、协调文件或运行数据。

## Goal

完成前端里“代码层”的工作流模式接线，供远端 Codex 负责浏览器和视觉验证：

1. 让前端 JS 正确调用 `PUT /api/projects/:id/workflow-mode`。
2. 正确处理 `200` 和 `409 WORKFLOW_MODE_RESET_REQUIRED`，把响应状态映射到项目数据。
3. 把 `single_video` 和 `legacy_multi_segment` 的模式状态、项目阶段、storyboard / video 数据形状接到现有前端状态流里。
4. 保持所有可见文案为中文，避免把技术名直接暴露给用户。
5. 不做 CSS / 布局 / 截图调优，把这些留给远端 Codex。

## Scope

Allowed:

- `studio-v2/public/js/**`
- `studio-v2/admin/*.js`
- `studio-v2/tests/**`

Do not edit:

- `studio-v2/src/**`
- `docs/contracts/**`
- `schemas/**`
- `studio-v2/public/css/**`
- `studio-v2/public/*.html`
- root coordination files
- `.env`
- 上传图片、生成结果、日志或 PID 文件

## Verification

- 所有修改的 JS 执行 `node --check`
- 相关测试通过
- `git diff --check` 通过
- 不做截图验证，不做浏览器视觉结论

## Delivery

完成后 push `deepseek/frontend-workflow-mode-code`，回报：

- 修改文件
- 提交号
- JS 检查结果
- 测试结果
- 是否触碰禁区

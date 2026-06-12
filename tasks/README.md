# 任务读取与发布规范

这个目录是项目任务的正式入口。聊天记录和截图只做解释，不作为开工依据。

## 每次开工先读什么

所有角色都先 fetch，然后读取：

1. `origin/main:CURRENT_ASSIGNMENTS.md`
2. `origin/main:tasks/README.md`
3. 自己对应的任务文件
   - 后端：`origin/main:tasks/codex-backend-current.md`
   - 前端：`origin/main:tasks/codex-frontend-current.md`
   - DeepSeek 代码编辑助手：`origin/main:tasks/deepseek-frontend-current.md`

## 当前任务文件

- 后端：`tasks/codex-backend-current.md`
- 前端：`tasks/codex-frontend-current.md`
- DeepSeek 代码编辑任务：`tasks/deepseek-frontend-current.md`

## 任务发布方式

协调端发布新任务时，必须同时做到：

1. 更新 `CURRENT_ASSIGNMENTS.md`
2. 更新对应任务文件
3. 必要时更新 `tasks/README.md`
4. 提交并推送到 `main / v2 / ui-v2`
5. 创建或更新对应任务分支
6. 本机后端任务可以直接发到本地后端对话
7. 前端任务只通过 GitHub 发布，不发到本机前端对话
8. DeepSeek 代码编辑任务也通过 GitHub 发布，只处理代码和测试，不负责截图或浏览器视觉验收

## 回报要求

任务执行端回报时必须包含：

- `Skills: nadirclaw-model-router, superpowers-workflow`
- `Route`
- 分支名
- 提交号
- 修改文件
- 测试或浏览器验证结果
- 是否触碰禁区

## 当前正式基线

以 `CURRENT_ASSIGNMENTS.md` 为准。本文件只定义读取和发布规则，不替代任务文件。

# 任务读取与发布规范

这个目录是项目任务的正式入口。聊天记录和截图只做解释，不作为开工依据。

## GitHub 上传范围

GitHub 当前任务只用于另一台前端电脑领取任务。

本机 Codex 和 DeepSeek 的任务由协调端直接发布，不需要上传为 GitHub 当前任务文件。

## 前端电脑每次开工先读什么

前端电脑先 fetch，然后读取：

1. `origin/main:CURRENT_ASSIGNMENTS.md`
2. `origin/main:tasks/README.md`
3. `origin/main:tasks/codex-frontend-current.md`

如果这些文件没有新任务，说明前端任务还没有正式发布；不要从聊天记录、截图、本机旧文件或其它旧分支开工。

## 本地执行者怎么拿任务

- 本机 Codex：由协调端直接发送任务到本地 Codex 对话。
- DeepSeek：由用户手动粘贴协调端给出的任务文本，或在本机直接发布。

本地执行者可以按要求提交代码分支并回传提交号，但它们的任务说明不作为 GitHub 当前任务上传。

## 前端任务发布方式

协调端发布前端任务时，必须同时做到：

1. 更新 `CURRENT_ASSIGNMENTS.md`
2. 更新 `tasks/codex-frontend-current.md`
3. 必要时更新 `tasks/README.md`
4. 提交并推送到 `main / v2 / ui-v2`
5. 创建或更新前端任务分支

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

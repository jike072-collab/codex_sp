# 任务读取与发布规范

这个目录是项目任务的正式入口。聊天记录和截图只做解释，不作为开工依据。

## GitHub 上传范围

- 本机 Codex 任务由协调端直接发送到本地 Codex 对话。
- DeepSeek 任务通过独立 GitHub 任务分支发布。
- 另一台电脑前端任务只通过 GitHub 正式任务入口发布。

## 前端电脑每次开工先读什么

前端电脑先 fetch，然后读取：

1. `origin/main:CURRENT_ASSIGNMENTS.md`
2. `origin/main:tasks/README.md`
3. `origin/main:tasks/codex-frontend-current.md`

如果这些文件没有新任务，说明前端任务还没有正式发布；不要从聊天记录、截图、本机旧文件或其它旧分支开工。

## 本地执行者怎么拿任务

- 本机 Codex：由协调端直接发送任务到本地 Codex 对话。
- DeepSeek：fetch 后读取指定任务分支的 `CURRENT_ASSIGNMENTS.md` 和 `tasks/codex-deepseek-current.md`。

DeepSeek 没有识图能力，只能根据代码、测试和文字验收标准工作。

当前 DeepSeek 任务读取方式：

```powershell
git fetch origin --prune
git show origin/codex/deepseek-admin-provider-key-review:CURRENT_ASSIGNMENTS.md
git show origin/codex/deepseek-admin-provider-key-review:tasks/codex-deepseek-current.md
```

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

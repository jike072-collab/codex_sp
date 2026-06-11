# 任务读取与提交规范

这个目录是项目任务的唯一正式入口。聊天记录只做解释，不做开工依据。

## 每次开工先读什么

所有 Codex 对话开工前固定读取：

1. `CURRENT_ASSIGNMENTS.md`
2. `tasks/README.md`
3. 自己角色的当前任务文件

当前任务文件只有两个：

- 后端：`tasks/codex-backend-current.md`
- 前端：`tasks/codex-frontend-current.md`

历史任务文件只用于回看，不作为当前任务入口。

## 前端电脑怎么找任务

前端电脑只通过 GitHub 找任务：

```powershell
git fetch origin --prune
git show origin/main:CURRENT_ASSIGNMENTS.md
git show origin/main:tasks/README.md
git show origin/main:tasks/codex-frontend-current.md
```

然后切换到 `tasks/codex-frontend-current.md` 里写明的前端任务分支。

如果 `origin/main` 的 `tasks/codex-frontend-current.md` 没有新任务，说明任务还没正式发布。不要从聊天记录、截图、本机旧文件或其它旧分支开工。

## 后端电脑怎么找任务

本机后端对话会收到协调端的直接任务消息，但仍必须以 GitHub 文件为准：

```powershell
git fetch origin --prune
git show origin/main:CURRENT_ASSIGNMENTS.md
git show origin/main:tasks/README.md
git show origin/main:tasks/codex-backend-current.md
```

然后切换到 `tasks/codex-backend-current.md` 里写明的后端任务分支。

## 协调端怎么发布任务

协调端发布任何新任务必须同时做到：

1. 更新 `CURRENT_ASSIGNMENTS.md`。
2. 更新对应 `tasks/codex-backend-current.md` 或 `tasks/codex-frontend-current.md`。
3. 必要时更新本文件。
4. 提交并推送到 `main / v2 / ui-v2`。
5. 创建或更新对应任务分支。
6. 本机后端任务额外发送到本地后端对话。
7. 前端任务只通过 GitHub 发布，不发送到本机前端对话。

## 提交和回报要求

任务执行端提交时必须报告：

- 使用技能：`nadirclaw-model-router`、`superpowers-workflow`
- Route
- 分支名
- 提交号
- 修改文件
- 测试或浏览器验证结果
- 是否触碰了禁止范围

## 当前正式任务分支

当前分支以 `CURRENT_ASSIGNMENTS.md` 为准。本文件只定义读取规则，不替代当前分工。

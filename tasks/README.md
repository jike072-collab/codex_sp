# 任务读取与提交规范

本目录是项目任务的唯一正式入口。聊天记录和截图只用于解释，不作为开工依据。

## 固定读取顺序

每次开工先执行 fetch，然后读取：

1. `origin/main:CURRENT_ASSIGNMENTS.md`
2. `origin/main:tasks/README.md`
3. 当前角色任务文件
   - 后端：`origin/main:tasks/codex-backend-current.md`
   - 前端：`origin/main:tasks/codex-frontend-current.md`

## 当前任务

- 后端分支：`codex/backend-single-storyboard-script-quality`
- 前端分支：`codex/frontend-single-storyboard-script-view`
- 前端依赖后端先冻结单故事板契约。

## 发布规则

- 本机后端：任务文件推送 GitHub 后，协调端还要把同一任务直接发送到本地后端 Codex 对话。
- 另一台前端：只通过 GitHub 任务文件和任务分支领取，不发送到本机前端对话。
- 前端找不到任务时，必须 fetch 后查看 `origin/main`，不能查看本地旧分支。

## 提交回报

必须包含：

- `Skills: nadirclaw-model-router, superpowers-workflow`
- `Route: simple|standard|complex`
- 分支名
- 提交号
- 修改文件
- 测试或浏览器验证结果
- 是否触碰禁止范围

不得提交：

- `.env`
- API Key
- `studio-v2/data/**`
- 上传图片
- 生成结果
- 日志
- PID 文件

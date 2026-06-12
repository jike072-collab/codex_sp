# 当前并行分工

所有 Codex 开工前必须依次调用：

1. `$nadirclaw-model-router`
2. `$superpowers-workflow`

任务回报必须包含：

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## 唯一任务入口

所有电脑都先 fetch，再只读取 GitHub 上的：

1. `origin/main:CURRENT_ASSIGNMENTS.md`
2. `origin/main:tasks/README.md`
3. 当前角色任务文件
   - 后端：`origin/main:tasks/codex-backend-current.md`
   - 前端：`origin/main:tasks/codex-frontend-current.md`

聊天记录、截图、旧分支和本地旧任务文件都不是开工依据。

## 当前基线

- 正式基线：`origin/main` 最新提交，至少包含 `1fc7930`
- 正式分支：`main / v2 / ui-v2`
- 协调端：发布任务、审核提交、合并、回归、同步正式分支
- 本机后端：只改后端、契约、schema 和测试
- 另一台电脑前端：只改 `studio-v2/public/**`

## 本轮产品决定

当前可见流程先统一成：

- 一条完整脚本时间线
- 一张完整故事板
- 故事板只调用一次生图 provider
- 20 秒旧项目显示为 `0-20s` 完整故事板
- 新的可变时长项目显示为 `0-{videoDurationSeconds}s` 完整故事板

旧的双段脚本、双故事板、双绘图通道代码和数据兼容能力不得删除，保留为 future/legacy 能力；但当前用户界面和当前故事板生成路径不再显示或触发两张故事板。

脚本镜头不允许只改时间、其余字段整行重复。后端必须检查镜头内容差异，不能让重复套话通过确认。

## Codex A：本机后端

状态：READY

任务文件：

- `tasks/codex-backend-current.md`

任务分支：

- `codex/backend-single-storyboard-script-quality`

允许修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`

禁止修改：

- `studio-v2/public/**`
- `studio-v2/admin/**`
- `.env`
- `studio-v2/data/**`
- 上传、生成、日志和 PID 文件

## Codex B：另一台电脑前端

状态：WAITING FOR BACKEND CONTRACT

任务文件：

- `tasks/codex-frontend-current.md`

任务分支：

- `codex/frontend-single-storyboard-script-view`

允许修改：

- `studio-v2/public/**`

禁止修改：

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `docs/contracts/**`
- `schemas/**`
- `studio-v2/admin/**`

前端必须先看到后端分支的新契约与交付提交，再开始依赖接口形状的实现；可以先读取任务，不得猜字段。

## 固定产品规则

- 生图只能 img2img，必须携带已上传商品参考图。
- 不允许 prompt-only fallback，不允许降级生图。
- 当前故事板只发起一次生成请求。
- 生成成功图保存在本地项目中。
- API Key 只能保存在本地设置，页面只显示 masked preview。
- 不恢复 JSON / ZIP / CSV / Flow Omni 下载按钮。
- 外层 storyboard sheet 不强行套视频比例；内部 shot frame 按第二步选择比例构图。
- 不做消费、余额、扣费、支付、价格展示或用量统计。

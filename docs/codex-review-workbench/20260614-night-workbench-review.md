# 20260614 夜间工作台审查记录

## Assumption

本轮优先做好桌面网页端，小白能看懂第一步并继续操作。手机端先保证不明显溢出，后续再 polish。

## Current Repo

- 路径：`E:\codex工作台\P001-codex_sp仓库`
- 仓库：`https://github.com/jike072-collab/codex_sp`
- 分支：`codex/night-workbench-review`
- 基线 commit：`949c8b2f5bf0e1418e1aad886837df915b29db55`
- 远端 main：同 `949c8b2f5bf0e1418e1aad886837df915b29db55`

## Module: 启动与测试

Changed:
- 未改服务端。

Verified:
- `node --check studio-v2/server.mjs`
- `node --check studio-v2/public/js/main.js`
- `node --check studio-v2/public/js/render.js`
- `node --check studio-v2/public/js/projects.js`
- `node --test studio-v2/tests/*.test.mjs`，63/63 通过。
- 8810 返回 HTTP 200。

Issue Found:
- 自动化测试覆盖核心 API 和域逻辑，但不覆盖浏览器视觉完整闭环。

## Module: 单段/双段存在性

Changed:
- 未改模式契约。

Verified:
- 新项目默认 `single_video`。
- 自动化测试覆盖单段一张 full 故事板、一个视频任务；双段两张故事板、两个视频任务。
- 前台显示“单段 5-15 秒 / 双段 20 秒”。

Issue Found:
- README、studio-v2 README、PRODUCT、DESIGN 仍有旧双段叙述。

## Module: 桌面网页端 P0

Changed:
- `studio-v2/public/js/render.js`：项目工作区标题从隐藏改为显示当前项目名。

Verified:
- `node --check studio-v2/public/js/render.js` 通过。
- 1440x900 浏览器刷新后显示项目名“夜间烟测鞋款”。
- 上传 1 张烟测图片后，素材数量显示 `1 张`，按钮“识别并锁定产品”可用。
- 控制台无 error/warning。
- 页面无横向溢出。

Issue Found:
- 烟测项目与图片生成在 `studio-v2/data/`，属于本地运行数据，不能提交。

## Module: 手机端基础检查

Changed:
- 本轮未做手机端样式改造。

Verified:
- 390x844 首屏无横向溢出，控制台无 error/warning。

Issue Found:
- 手机端完整工作区流程尚未验收；用户已明确手机端优先级低于网页端。

## 待用户确认

- 是否把“单段/双段”改成更小白的“一个视频 / 两段视频”。
- 是否允许下一轮把 README、PRODUCT、DESIGN 统一成当前单段默认的新口径。

## Suggested Next Step

下一步优先做桌面网页端完整浏览器闭环：新建项目 -> 上传 -> 识别 -> 确认产品 -> 生成脚本 -> 确认脚本 -> 故事板失败/重试或成功 -> Step 05 视频入口。

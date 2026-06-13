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

## Module: 桌面闭环烟测

Changed:
- 未继续改接口或流程。

Verified:
- 1440x900 浏览器实测：Step 01 上传后按钮“识别并锁定产品”可用。
- 点击识别进入 Step 02，页面显示“产品锁定与创意设置”和“确认并进入脚本”。
- 点击确认进入 Step 03，页面显示“生成脚本”。
- 通过本地 API 生成脚本后刷新，Step 03 显示 10 秒广告脚本和“确认脚本并生成故事板图片”。
- 点击确认后进入 Step 04。
- 无图片 Key 时，页面显示“绘图通道 A 未配置可用的图片 API Key。”，并保留“重新生成故事板”按钮。
- 全程控制台无 error/warning，页面无横向溢出。

Issue Found:
- 浏览器里按文本定位“生成脚本”会匹配到主按钮和隐藏弹窗按钮两个元素；用户视觉上影响不大，但后续自动化测试应优先用按钮 id 或限定当前 stage。
- 成功故事板预览/下载和 Step 05 视频下载尚未实测，因为本机未配置图片/视频 Key。

## Module: 手机端基础检查

Changed:
- 本轮未做手机端样式改造。

Verified:
- 390x844 首屏无横向溢出，控制台无 error/warning。

Issue Found:
- 手机端完整工作区流程尚未验收；用户已明确手机端优先级低于网页端。

## Module: GPT 参考图桌面端口径吸收

Changed:
- 新增 `docs/codex-review-workbench/20260614-ui-reference-direction.md`，记录 4 张 GPT 效果图的可复用方向和未照抄项。
- 新增 `docs/reference/gpt-ui-direction-20260614/`，保存用户提供的 4 张 UI 参考图。
- `studio-v2/public/index.html`：五步文案统一为“商品素材 / 产品设定 / 生成脚本 / 生成故事板 / 导出计划”。
- `studio-v2/public/index.html`：Step 01 标题改为“上传商品素材”，上传区文案改为“拖拽图片到此处，或点击上传”。
- `studio-v2/public/js/render.js`：右侧面板改为“AI 素材检测器 / AI 产品检查器 / AI 脚本检查官 / AI 故事板检查 / 导出计划”。
- `studio-v2/public/js/core.js`、`studio-v2/public/js/demo-loop.js`：Step 04/05 的状态与标题口径统一为“生成故事板 / 导出计划”。

Verified:
- `node --check studio-v2/public/js/core.js` 通过。
- `node --check studio-v2/public/js/render.js` 通过。
- `node --check studio-v2/public/js/demo-loop.js` 通过。
- `git diff --check` 通过，仅有工作区 CRLF 提示。
- 1440x900 内置浏览器实测 Step 05：页面显示“导出计划”，不再出现 `h2=生成视频`，控制台无 error/warning，无文档级横向溢出。
- 390x844 内置浏览器基础检查：文档级无横向溢出，控制台无 error/warning。

Issue Found:
- 手机端步骤条仍为横向滚动项，属于现有移动端基础方案；用户本轮优先桌面网页端，后续再 polish。
- Chrome 扩展浏览器通道不可用，本轮改用 Codex 内置浏览器完成页面验证。

## Module: README / PRODUCT / DESIGN 口径统一

Changed:
- `README.md`：第一版流程改为创建项目、上传素材、选择单段/双段、产品锁定、脚本、故事板、导出计划、预览或下载。
- `studio-v2/README.md`：补充单段 5-15 秒和双段 20 秒的差异，说明普通前台不显示 API Key、供应商、模型、prompt 或调试信息。
- `studio-v2/PRODUCT.md`：第一版闭环和页面流程改为当前单段/双段、故事板、导出计划口径。
- `DESIGN.md`：设计规范更新为当前深色左侧栏、亮色工作区、荧光绿主操作和右侧检查器结构。
- `docs/产品口径.md`、`docs/验收清单.md`：移除已过期的文档漂移提示。

Verified:
- 与当前 `studio-v2/public` 文案和 `docs/产品口径.md` 对齐。
- 未修改后端、契约、schema、运行数据或 provider 配置。

Issue Found:
- 视觉 token 虽已在 `DESIGN.md` 补到当前主要色值，但完整字体、字号、字重、行高、spacing、radius、shadow、border token 表仍需单独细化。

## 待用户确认

- 是否把“单段/双段”改成更小白的“一个视频 / 两段视频”。
- 是否允许下一轮把 README、PRODUCT、DESIGN 统一成当前单段默认的新口径。

## Suggested Next Step

下一步优先继续桌面网页端完整闭环和视觉 token 文档：新建项目 -> 上传 -> 识别 -> 确认产品 -> 生成脚本 -> 确认脚本 -> 故事板失败/重试或成功 -> Step 05 导出计划，并补齐字体、间距、圆角、阴影、边框、颜色 tokens。

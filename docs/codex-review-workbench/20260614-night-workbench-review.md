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
- 自动化测试覆盖单段一张 full 故事版、一个视频任务；双段两张故事版、两个视频任务。
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
- 通过本地 API 生成脚本后刷新，Step 03 显示 10 秒广告脚本和“确认脚本并生成故事版”。
- 点击确认后进入 Step 04。
- 无图片 Key 时，页面显示“绘图通道 A 未配置可用的图片 API Key。”，并保留“重新生成故事版”按钮。
- 全程控制台无 error/warning，页面无横向溢出。

Issue Found:
- 浏览器里按文本定位“生成脚本”会匹配到主按钮和隐藏弹窗按钮两个元素；用户视觉上影响不大，但后续自动化测试应优先用按钮 id 或限定当前 stage。
- 成功故事版预览/下载和 Step 05 视频下载尚未实测，因为本机未配置图片/视频 Key。

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
- `studio-v2/public/index.html`：五步文案统一为“商品素材 / 产品设定 / 生成脚本 / 生成故事版 / 生成视频”。
- `studio-v2/public/index.html`：Step 01 标题改为“上传商品素材”，上传区文案改为“拖拽图片到此处，或点击上传”。
- `studio-v2/public/js/render.js`：右侧面板改为“AI 素材检测器 / AI 产品检查器 / AI 脚本检查官 / AI 故事版检查 / 生成视频”。
- `studio-v2/public/js/core.js`、`studio-v2/public/js/demo-loop.js`：Step 04/05 的状态与标题口径统一为“生成故事版 / 生成视频”。

Verified:
- `node --check studio-v2/public/js/core.js` 通过。
- `node --check studio-v2/public/js/render.js` 通过。
- `node --check studio-v2/public/js/demo-loop.js` 通过。
- `git diff --check` 通过，仅有工作区 CRLF 提示。
- 1440x900 内置浏览器实测 Step 05：页面显示“生成视频”，不再出现 `导出计划` 作为主流程文案，控制台无 error/warning，无文档级横向溢出。
- 390x844 内置浏览器基础检查：文档级无横向溢出，控制台无 error/warning。

Issue Found:
- 手机端步骤条仍为横向滚动项，属于现有移动端基础方案；用户本轮优先桌面网页端，后续再 polish。
- Chrome 扩展浏览器通道不可用，本轮改用 Codex 内置浏览器完成页面验证。

## Module: README / PRODUCT / DESIGN 口径统一

Changed:
- `README.md`：第一版流程改为创建项目、上传素材、选择单段/双段、产品锁定、脚本、故事版、生成视频、预览或下载。
- `studio-v2/README.md`：补充单段 5-15 秒和双段 20 秒的差异，说明普通前台不显示 API Key、供应商、模型、prompt 或调试信息。
- `studio-v2/PRODUCT.md`：第一版闭环和页面流程改为当前单段/双段、故事版、生成视频口径。
- `DESIGN.md`：设计规范更新为当前深色左侧栏、亮色工作区、荧光绿主操作和右侧检查器结构。
- `docs/产品口径.md`、`docs/验收清单.md`：移除已过期的文档漂移提示。

Verified:
- 与当前 `studio-v2/public` 文案和 `docs/产品口径.md` 对齐。
- 未修改后端、契约、schema、运行数据或 provider 配置。

Issue Found:
- 视觉 token 虽已在 `DESIGN.md` 补到当前主要色值，但完整字体、字号、字重、行高、spacing、radius、shadow、border token 表仍需单独细化。

## Module: 视觉 token 与桌面宽度复验

Changed:
- 新增 `docs/codex-review-workbench/20260614-visual-tokens.md`，按当前 `studio-v2/public/styles.css` 记录字体、字号、字重、行高、颜色、间距、圆角、阴影、边框、组件和动效基线。
- 更新 `docs/验收清单.md`，把 1366 和 1280 桌面宽度基础复验结果写入 P1。

Verified:
- 1366x768 内置浏览器复验：`scrollWidth=1351`、`clientWidth=1366`，无文档级横向溢出；控制台 error/warn 为空；Step 05 右侧面板显示“生成视频”。
- 1280x800 内置浏览器复验：`scrollWidth=1265`、`clientWidth=1280`，无文档级横向溢出；控制台 error/warn 为空；Step 05 右侧面板显示“生成视频”。

## Module: 用户口径纠正 - Step 04/05

Changed:
- 用户明确纠正：第五步是“生成视频”，不要“最终导出”；第四步是“生成故事版”，不要出现“图片”。
- `studio-v2/public/index.html`、`core.js`、`render.js`、`demo-loop.js`、`projects.js`、`main.js` 已同步普通前台文案。
- `README.md`、`studio-v2/README.md`、`studio-v2/PRODUCT.md`、`DESIGN.md`、`docs/产品口径.md`、`docs/验收清单.md` 和本审查记录同步更新。

Verified:
- `node --check studio-v2/public/js/core.js` 通过。
- `node --check studio-v2/public/js/render.js` 通过。
- `node --check studio-v2/public/js/demo-loop.js` 通过。
- `node --check studio-v2/public/js/projects.js` 通过。
- `node --check studio-v2/public/js/main.js` 通过。
- `node --test studio-v2/tests/*.test.mjs`，63/63 通过。
- 1440x900、1366x768、1280x800 内置浏览器复验：步骤条显示“04 生成故事版 / 05 生成视频”，右侧面板标题为“生成视频”；正文不再出现“导出计划”“最终交付”“故事板图片”；控制台 error/warn 为空；无文档级横向溢出。

Issue Found:
- `docs/contracts/local-settings-api.md` 仍保留“故事板图片模型”等后台契约描述，属于技术配置/接口文档，不作为普通前台口径展示。

## Module: P0 成功态预览下载与公开错误文案

Changed:
- `studio-v2/public/js/core.js` 新增普通前台公开错误文案净化，屏蔽 API Key、供应商、模型、prompt、provider 等技术原文。
- `studio-v2/public/js/demo-loop.js`、`projects.js`、`main.js` 接入净化文案，Step 04/05 失败提示保留可理解的人话。
- `studio-v2/public/js/render.js` 把“供应商未就绪”改成“当前使用演示识别；如需真实识别，可请管理员完成后台配置”。

Verified:
- 1440x900 内置浏览器打开成功态项目 `success-mqcnwruf`。
- 单段模式 Step 04：页面标题“故事版生成完成”，故事版卡片数量 `1`，下载入口为“下载故事版”，链接 `/uploads/success-mqcnwruf/storyboard-full-smoke.png`。
- Step 05：页面标题“生成视频”，存在视频播放器 `src=/uploads/success-mqcnwruf/video-full-smoke.mp4`，下载入口为“下载视频”。
- 成功态正文未出现 `API Key`、供应商、模型、prompt、provider、Right Code、DeepSeek、Gemini、Draw 等技术词；控制台 error/warn 为空；无文档级横向溢出。

Issue Found:
- 真实外部生成成功态仍取决于本地后台配置；本轮验证使用本机已有成功烟测项目，不写入或提交 `studio-v2/data/`。
- 8810 本地页面返回 HTTP 200。

Issue Found:
- 内置浏览器截图接口此前在 `Page.captureScreenshot` 超时，本轮改用 DOM 指标、控制台日志和文案检查完成基础复验；1366/1280 截图留档仍待后续单独补图。
- 当前打开的是已有 Step 05 成功态烟测项目，`hasUpload=false` 属于项目状态差异；上传入口已在 Step 01 和此前 1440x900 闭环中验证。

## 待用户确认

- 是否把“单段/双段”改成更小白的“一个视频 / 两段视频”。
- 是否允许下一轮把 README、PRODUCT、DESIGN 统一成当前单段默认的新口径。

## Suggested Next Step

下一步优先补 1366/1280 截图留档和成功态预览/下载实测；如果仍未配置图片/视频 Key，则先保留“成功后预览/下载路径需要浏览器实测”为待确认风险。

## Module: 目标图 UI 对比与网页端改造

Changed:
- `studio-v2/public/index.html`：补顶部“已保存到本地 / 设置”操作区，侧栏底部补生成服务状态，右侧 AI 面板增加“是否可进入下一步”和“小贴士”。
- `studio-v2/public/js/render.js`：侧边栏项目卡改为项目名、状态、素材数量、更新时间的结构；右侧 AI 面板根据当前步骤输出真实就绪状态和建议。
- `studio-v2/public/styles.css`：追加目标图方向的浅色工作区、深色侧栏、绿色主按钮、精致五步卡片、白色主卡片、右侧 AI 检查卡、桌面端响应式覆盖。

目标图对比:
- 当前缺少的区域：原页面顶部缺少独立保存/设置区，侧栏底部没有生成服务状态，右侧面板缺少明确的“是否可进入下一步”判断。
- 布局差异：目标图是稳定三栏工作台；当前已有三栏雏形，但右侧此前更像信息展示，项目列表也不够像项目卡。
- 步骤流差异：目标图步骤完成/当前/未完成状态更精细；本轮保留五步方框并加强完成、当前、高亮、弱化状态。
- 右侧 AI 面板差异：目标图每一步都是检查官；本轮增加阶段标题、进度、就绪判断、阶段数据和小贴士，辅助用户决定下一步。
- 上传/生成/预览差异：业务流程不改，单段/双段保留；Step 04 单版保持一张故事版，Step 05 保持生成视频。
- 字体颜色差异：本轮按 Inter/system/PingFang/Microsoft YaHei、浅灰背景、白卡、柠檬绿主色、细边框和轻阴影追加统一样式。

Verified:
- 待本轮 UI 修改后跑 `node --check`、`node --test` 和桌面浏览器复验。

Issue Found:
- 内置浏览器句柄短暂失效，后续需要重新连接后补截图或 DOM 复验。

## Module: 补齐桌面/移动验收与截图留档

Changed:
- 新增桌面与移动截图留档：
  - `docs/codex-review-workbench/20260614-ui-1366x768.png`
  - `docs/codex-review-workbench/20260614-ui-1280x800.png`
  - `docs/codex-review-workbench/20260614-ui-390x844.png`
- 更新 `docs/验收清单.md`，把目标图 UI、右侧就绪判断、项目卡、顶部状态、Step 04/05 口径、桌面截图留档和移动端基础检查标记为完成。

Verified:
- 1366x768：`scrollWidth=1351`，`clientWidth=1366`，无横向溢出，控制台无 error/warn，旧词未出现。
- 1280x800：`scrollWidth=1265`，`clientWidth=1280`，无横向溢出，控制台无 error/warn，旧词未出现。
- 390x844：`scrollWidth=375`，`clientWidth=390`，无文档级横向溢出，控制台无 error/warn。
- 截图文件已保存在审查目录中，没有写入根目录。

Issue Found:
- 手机端步骤条仍保持横向滚动，属于已接受的基础方案，后续可再做触控优化。

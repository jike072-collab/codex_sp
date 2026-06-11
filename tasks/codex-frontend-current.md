# Codex B Current Frontend Task

Status: READY - START NOW

Target: 另一台前端电脑

Published: 2026-06-11 Asia/Shanghai

Route: complex

Branch: `codex/frontend-step1-single-image`

Start from: latest `origin/main`

## Required Skills

Start every task or resumed task with:

```text
Skills: nadirclaw-model-router, superpowers-workflow
Route: complex
```

## Goal

重做 Step 01 的可用性：上传一张四视图拼图即可开始识别，删除按钮真正可用，字号清楚，页面不再留下大块空白。

## P0 Functional Work

1. 最小上传门槛从 4 个文件改为 1 个文件：
   - 上传 1 张后立即启用“识别并锁定产品”。
   - `analyze()` 不得再用 `< 4` 阻止调用。
   - 单张图片包含多个角度时，视为可直接识别的四视图拼图。
2. 删除所有硬编码的四张门槛：
   - `1/4`
   - “还需 3 张”
   - “第四张检查点”
   - “需要 4 张参考图”
   - 任何因不足 4 张而禁用下一步的判断
3. “建议 4-8 张”可以保留为弱提示，但必须明确是可选建议，不能影响按钮状态或流程。
4. 修复图片卡片右上角删除按钮：
   - 点击区域至少 32x32 CSS 像素。
   - 检查 `z-index`、`pointer-events`、父层覆盖和事件委托顺序。
   - 点击后真实发送 DELETE 请求。
   - 请求成功后卡片消失，素材数量、状态提示和进度立即更新。
   - 删除期间防重复点击；失败时显示中文错误并恢复按钮。
   - 不允许只改样式而不做浏览器点击验证。

## Visual Work

1. Step 01 主面板高度随内容收缩，移除截图中图片下方的大块空白。
2. 放大过小文字：
   - 正文和状态说明建议不低于 13px。
   - 主要按钮、上传提示和步骤名称建议 14-16px。
   - 辅助文字也要清晰，不要使用 9-10px 作为主要信息。
3. 右侧状态区不再显示以 4 张为分母的伪进度；改成“已上传 N 张 / 可以识别”以及可选补图建议。
4. 保持页面无横向滚动、右侧不裁切，图片完整显示。
5. 不要破坏 Step 02-05、管理后台或现有故事板功能。

## Scope

Allowed:

- `studio-v2/public/**`

Do not edit:

- `studio-v2/src/**`
- `studio-v2/tests/**`
- `studio-v2/admin/**`
- root coordination files
- `.env`、API Key、运行数据、上传图片、生成结果、日志或 PID 文件

## Required Verification

1. 对所有 `studio-v2/public/js/*.js` 执行语法检查。
2. 在真实浏览器中使用一个新项目验证：
   - 上传 1 张四视图拼图。
   - “识别并锁定产品”立即可点击。
   - 点击删除按钮，图片卡片确实消失且计数归零。
   - 再上传同一张图片，可以正常开始识别并进入下一步。
3. 检查常用桌面宽度和窄屏：无大块空白、无文字过小、无右侧裁切。
4. 提供 Step 01 修改后的截图和删除成功后的截图。

## Delivery

Push `codex/frontend-step1-single-image` and report:

- Skills and route
- Commit hash
- Changed files
- JS checks
- Browser verification results
- Screenshots
- Confirmation that no backend/Admin files or secrets were changed

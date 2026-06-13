# 20260614 UI 参考方向记录

Skills: nadirclaw-model-router, superpowers-workflow
Route: complex

## Assumption

本轮先做好网页端桌面工作台，手机端只保证不明显断裂。用户提供的 4 张 GPT 效果图作为方向参考，不逐像素复刻，也不直接复制外部站点代码。

## Reference Inputs

- `docs/reference/gpt-ui-direction-20260614/step01-upload-reference.png`
- `docs/reference/gpt-ui-direction-20260614/step02-product-reference.png`
- `docs/reference/gpt-ui-direction-20260614/step03-script-reference.png`
- `docs/reference/gpt-ui-direction-20260614/step04-storyboard-reference.png`
- Pinterest：仅作为视觉情绪和构图灵感，不作为代码来源。
- 21st.dev community components：可后续参考组件密度、按钮和卡片状态，但当前项目不引入新依赖。

## Useful Direction

- 桌面端保持深色左侧项目区、白色主工作区、荧光绿主操作按钮。
- 顶部步骤文案保持 5 步：商品素材、产品设定、生成脚本、生成故事版、生成视频。
- 主区域只承载当前步骤的核心任务，右侧固定为当前步骤检查器。
- 右侧检查器用自然语言说明当前状态，不暴露 API Key、模型供应商或技术调试词。
- 底部主要按钮保持明确下一步，例如识别并锁定产品、确认并进入脚本、生成故事版、生成视频。

## Applied This Round

- Step 04 按用户最新口径改为“生成故事版”，不在普通前台标题和按钮里写“图片”。
- Step 05 按用户最新口径改回“生成视频”，不叫“导出计划”或“最终交付”。
- Step 01 主标题从“整理商品素材”改为“上传商品素材”，第一步更直观。
- 上传区文案调整为“拖拽图片到此处，或点击上传”，贴近参考图表达。
- 右侧面板标题改为阶段检查器口径：
  - AI 素材检测器
  - AI 产品检查器
  - AI 脚本检查官
  - AI 故事版检查
  - 生成视频

## Not Applied Yet

- 未引入设置按钮、API 状态卡或模型名称展示，因为第一版前台不能暴露复杂供应商信息。
- 未大改卡片布局和尺寸，避免破坏已经验证过的本地闭环。
- 未从 Pinterest 或 21st.dev 复制代码；后续如果使用组件灵感，应先整理为本项目自己的 CSS token 和状态规范。

## Validation Target

- 1440x900 桌面端：首屏知道第一步是上传商品素材。
- 控制台无明显 error/warning。
- 不出现水平滚动。
- 上传后按钮与下一步路径仍可用。
- 失败状态继续保留重试路径。

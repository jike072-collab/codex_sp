# 20260614 视觉 Tokens 草案

Skills: nadirclaw-model-router, superpowers-workflow
Route: complex

## Assumption

本文件记录当前 `studio-v2/public/styles.css` 已经在使用的桌面网页端视觉规则，先作为 P1 一致性基线。后续做 UI polish 时优先复用这些 tokens，不为单个组件临时发明新样式。

## Font

- 全局字体：`Inter, "Segoe UI", "Microsoft YaHei", sans-serif`
- 标题字体：`Georgia, "Microsoft YaHei", serif`
- 等宽信息：`ui-monospace, SFMono-Regular, Menlo, monospace`

## Typography

| 用途 | 字号 | 字重 | 行高 | 说明 |
| --- | --- | --- | --- | --- |
| 工作区项目标题 | `34px` | `700` | `1.1` | 宽桌面主标题 |
| Review 状态标题 | `30px` | `700` | `1.1` | Step 02 紧凑状态 |
| 空状态标题 | `42-70px clamp` | `700` | `1.08` | 只用于空项目入口 |
| 步骤标题 / 弹窗标题 | `29px` | `700` | `1.2` | 当前阶段主标题 |
| Review 步骤标题 | `26px` | `700` | `1.2` | Step 02 收紧高度 |
| 正文说明 | `13px` | `400` | `1.65` | 阶段说明、帮助文案 |
| 上传帮助正文 | `12px` | `400` | `1.45` | 上传区与角度卡 |
| 按钮文字 | `11-13px` | `750-800` | `1` | 主按钮、工具按钮 |
| 标签 / Kicker | `10px` | `900` | `normal` | `letter-spacing: 0.16em` |
| 表单标签 | `11px` | `800` | `normal` | 字段名和 field label |
| 右侧面板数值 | `13-14px` | `800-850` | `1` | 状态、数量、进度 |
| 脚本表格正文 | `8.5-9px` | `400-800` | `1.18-1.26` | 高密度脚本审查区 |

## Color

| Token | Value | 用途 |
| --- | --- | --- |
| `--ink` | `#171916` | 主文字、深色按钮文字 |
| `--muted` | `#6f746d` | 正文说明、次级文本 |
| `--line` | `#dcded7` | 通用边框和分割线 |
| `--paper` | `#f3f3ee` | 页面背景 |
| `--surface` | `#fbfbf7` | 主工作区表面 |
| `--white` | `#ffffff` | 卡片、输入框背景 |
| `--accent` | `#ddff3f` | 主操作、活跃状态、焦点强调 |
| `--accent-dark` | `#a8ca00` | 主操作描边、活跃步骤线 |
| `--green` | `#174f3a` | 成功、完成、kicker |
| `--warning` | `#8a5a12` | 警告提示文字 |
| Sidebar bg | `#171916` | 左侧栏背景 |
| Sidebar surface | `#242721` | 项目选中、工具按钮 |
| Focus ring | `rgba(221, 255, 63, 0.18-0.22)` | 输入框、chip 聚焦 |
| Error bg | `#fff7e6` | 质量提示背景 |

## Spacing

| Token | Value | 用途 |
| --- | --- | --- |
| `space-1` | `3-5px` | 紧凑图表、chip 内部间距 |
| `space-2` | `6-8px` | 小按钮、卡片内部小间距 |
| `space-3` | `9-12px` | 控件间距、chip padding |
| `space-4` | `14-18px` | 卡片组、项目卡、状态块 |
| `space-5` | `20-24px` | 阶段操作区、右侧面板 |
| `space-6` | `26-30px` | 主卡片、工作区标题 |
| `space-7` | `38-50px` | 桌面工作区外边距 |
| Sidebar width | `260px` | 固定左栏 |
| Workspace padding | `30px 38px 50px` | 常规桌面工作区 |
| Stage gap | `18px` | 主卡与右侧检查器间距 |

## Radius

| Token | Value | 用途 |
| --- | --- | --- |
| `radius-xs` | `3-4px` | 表格单元、迷你图表 |
| `radius-sm` | `5-7px` | 输入框、小按钮、视频卡 |
| `radius-md` | `8-10px` | 项目卡、上传区、选项卡 |
| `radius-lg` | `12px` | 主阶段卡、右侧检查器 |
| `radius-pill` | `999px` | 状态 pill、模式切换 |
| `radius-round` | `50%` | Logo、状态点、圆形图标 |

## Shadow

| Token | Value | 用途 |
| --- | --- | --- |
| `--shadow` | `0 18px 60px rgba(28, 32, 24, 0.08)` | 主卡片和检查器 |
| `shadow-soft` | `0 8px 20px rgba(23, 25, 22, 0.04)` | 设置 chip |
| `shadow-hover` | `0 14px 34px rgba(23, 25, 22, 0.07)` | 可选卡片 hover |
| `shadow-popover` | `0 22px 70px rgba(0, 0, 0, 0.28)` | 下拉菜单 |
| `shadow-icon` | `0 4px 14px rgba(0, 0, 0, 0.12)` | 图片删除按钮 |

## Border

| Token | Value | 用途 |
| --- | --- | --- |
| `border-default` | `1px solid var(--line)` | 主卡片、分割线 |
| `border-control` | `1px solid #ccd0c7` | 输入框、选择框 |
| `border-soft` | `1px solid #d9ddd2` | 设置区、右侧状态块 |
| `border-dashed` | `1px dashed #aeb4a8` | 上传 drop zone |
| `border-accent` | `1px solid var(--accent-dark)` | 主按钮 |
| `border-dark` | `1px solid #343830` | 深色弹层、侧栏工具 |

## Component Rules

- 主按钮：`min-height: 42px`，`padding: 0 18px`，`font-weight: 750`，背景使用 `--accent`。
- 大按钮：`min-height: 50px`，`padding: 0 24px`。
- 次按钮：透明背景，`border-control` 或 `#bbbfb6`，不抢主操作。
- 输入框：`height: 42px`，`border-radius: 7px`，focus 使用 lime ring。
- 文本域：`min-height: 84px`，`line-height: 1.5`，允许垂直 resize。
- 主卡片：白色半透明表面、`radius-lg`、`--shadow`，避免卡片套卡片。
- 步骤条：5 列桌面布局，活跃态用 lime 背景和边框，不用漂浮大圆覆盖文字。
- 右侧检查器：只显示当前步骤用户需要判断的数量、状态、进度、检查项。
- 模式切换：pill 分段控件，文案用 `单段 5-15 秒 / 双段 20 秒`，不显示数据模式名。

## Animation

- 常规 hover/active 转场：`0.18s ease`。
- 适用属性：`transform`、`opacity`、`border-color`、`box-shadow`、`background`。
- 上传拖拽：只增强边框和浅绿背景，不遮挡文件入口。
- 步骤切换：轻微进入动画即可，不能挡住当前操作。
- 失败提示：保持静态可读，优先给重试按钮。
- 后续新增动画必须尊重 `prefers-reduced-motion`。

## Desktop Breakpoints

- 主要桌面目标：`1440x900`。
- 必验桌面宽度：`1366x768`、`1280x800`。
- `max-width: 1180px` 时标题区域允许换行，视频任务改为单列。
- `max-width: 960px` 后进入窄屏规则，右侧面板堆叠或隐藏，不作为本轮桌面优先 polish 的主目标。

## Known Gaps

- `styles.css` 当前存在多段历史覆盖规则，后续整理时应按此 token 表收敛，但不要在没有视觉验证时大规模重排 CSS。
- 手机端步骤条仍为横向滚动，后续可单独优化触控体验。
- 1366 和 1280 桌面已做 DOM/控制台/横向溢出复验，后续仅需补截图留档来增强审查证据。

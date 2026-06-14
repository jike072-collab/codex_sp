# Shoe Ad Studio V2

面向个人使用的本地鞋类广告生产工具。

当前第一阶段已经覆盖：

1. 新建本地项目
2. 上传一组鞋子图片素材
3. 使用已配置的视觉模型识别，或在没有 API Key 时使用演示结果
4. 在前台选择 `单版 5-15 秒` 或 `双版 20 秒`
5. 人工确认产品锁定、投放目标和创意方向
6. 使用 DeepSeek 或演示模式生成并检查广告脚本
7. 按第二步选择的比例生成故事版
8. 生成视频，预览或下载视频任务

当前模式差异：

- `单版 5-15 秒`：默认模式，一条完整脚本、一张 `full` 故事版、一个视频任务。
- `双版 20 秒`：两个 10 秒脚本段、两张故事版、两个视频任务。

普通用户前台不显示 API Key、供应商、模型、prompt 或开发者调试信息。

## 启动

在项目根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\studio-v2\start.ps1
```

然后访问：

```text
http://127.0.0.1:8810
```

数据保存在 `studio-v2/data/`。API 配置继续读取项目根目录的 `.env`：

```env
VISION_MODEL=gemini-2.5-flash
VISION_API_URL=https://right.codes/gemini
VISION_MODEL_API_KEY=your_right_code_key

TEXT_MODEL=deepseek-v4-pro
TEXT_API_URL=https://api.deepseek.com/chat/completions
TEXT_MODEL_API_KEY=your_deepseek_key

IMAGE_MODEL=gpt-image-2
IMAGE_API_URL=https://www.right.codes/draw/v1/images/generations
IMAGE_MODEL_API_KEY=your_right_code_key
```

识图、脚本和图片生成的 Key 独立保存。即使识图和图片都使用 Right Code，
也可以填入不同 Key，并分别清除。没有配置某类可用 Key 时，该阶段会使用
明确标记的演示模式；已经配置 Key 但供应商调用失败时，服务会返回错误，
不会伪装成真实生成成功。

## 模块边界

- `public/js/`：前端状态、渲染与用户操作
- `src/local-api/`：HTTP 路由与静态资源服务
- `src/workflow-domain/`：业务规则与标准化
- `src/ai-providers/`：模型适配器
- `src/storage/`：项目和图片持久化

并行任务和文件所有权见 `../docs/TASKS.md`。

## 测试

安装 Node.js LTS 后，在项目根目录运行：

```powershell
node --test .\studio-v2\tests\*.test.mjs
```

测试使用系统临时目录，不会修改 `studio-v2/data/` 中的个人项目。

没有配置 API Key 时，识图和脚本可使用明确标记的本地演示模式；真实故事版和视频生成不会伪装成功，页面会给出可理解的失败提示和重试入口。

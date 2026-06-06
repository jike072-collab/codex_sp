# Shoe Ad Studio V2

面向个人使用的本地鞋类广告生产工具。

当前第一阶段已经覆盖：

1. 新建本地项目
2. 上传一组鞋子多视图图片
3. 使用已配置的视觉模型识别，或在没有 API Key 时使用演示结果
4. 人工编辑产品锁定信息
5. 确认并保存审核结果
6. 保存市场创意
7. 使用 DeepSeek 或演示模式生成并编辑 20 秒脚本
8. 生成四条视觉提示词，并可调用 gpt-image-2 生成图片
9. 下载不包含本地路径的 JSON 交付包

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
VISION_MODEL=gpt-5.4-mini
VISION_API_URL=https://www.right.codes/draw/v1/chat/completions
VISION_MODEL_API_KEY=your_right_code_key

TEXT_MODEL=deepseek-v4-pro
TEXT_API_URL=https://api.deepseek.com/chat/completions
TEXT_MODEL_API_KEY=your_deepseek_key

IMAGE_MODEL=gpt-image-2
IMAGE_API_URL=https://www.right.codes/draw/v1/images/generations
IMAGE_MODEL_API_KEY=your_right_code_key
```

Right Code 的识图和图片生成可以使用同一个 Key。没有配置某类可用 Key
时，该阶段会使用明确标记的演示模式；已经配置 Key 但供应商调用失败时，
服务会返回错误，不会伪装成真实生成成功。

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

没有配置 API Key 时，识图、脚本和视觉提示词都使用明确标记的本地演示模式，仍可跑完整闭环。

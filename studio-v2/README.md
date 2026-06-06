# Shoe Ad Studio V2

面向个人使用的本地鞋类广告生产工具。

当前第一阶段已经覆盖：

1. 新建本地项目
2. 上传一组鞋子多视图图片
3. 使用已配置的视觉模型识别，或在没有 API Key 时使用演示结果
4. 人工编辑产品锁定信息
5. 确认并保存审核结果

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
VISION_API_URL=https://api.openai.com/v1/chat/completions
VISION_MODEL_API_KEY=your_key
```

如果没有配置可用 Key，点击识别会返回明确标记为演示数据的结果，方便先验证工作流。

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

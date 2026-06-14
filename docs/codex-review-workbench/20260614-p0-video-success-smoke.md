# 2026-06-14 P0 视频成功烟测

## 范围

- 验证 Step 05 单版视频生成闭环。
- 使用隔离临时 `STUDIO_DATA_ROOT`，不依赖真实 `studio-v2/data/`。
- 使用本地假视频服务，不依赖真实 API Key、真实供应商或外网模型。

## 命令

```powershell
node --check docs\codex-review-workbench\p0-video-success-smoke.mjs
node docs\codex-review-workbench\p0-video-success-smoke.mjs
```

## 结果

```json
{
  "projectId": "p0-video-success-smoke",
  "workflowMode": "single_video",
  "generatedVideos": 1,
  "segmentStatus": "done",
  "finalVideoStatus": "unavailable",
  "downloadStatus": 200,
  "downloadBytes": 24
}
```

## 结论

- 单版 Step 05 会生成 1 个视频任务。
- `/videos/status` 可把分段视频刷新为 `done`。
- `/videos/full/download` 返回 `200` 和 `video/mp4` 下载内容。
- 单版模式没有合并视频，`finalVideoStatus` 为 `unavailable` 且原因是 `single_video_mode`，符合当前接口契约。

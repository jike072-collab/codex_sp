# Local Settings And Project Deletion API

These routes are available only through the loopback-bound local server.

## Delete Project

```http
DELETE /api/projects/:projectId
```

Behavior:

- Delete the persisted project record.
- Delete only that project's uploaded source-image directory.
- Do not affect any other project.
- Return `404` when the project does not exist.

Success:

```json
{
  "deletedProjectId": "opaque-project-id"
}
```

## Read Provider Settings

```http
GET /api/settings/providers
```

Response:

```json
{
  "providers": {
    "vision": {
      "provider": "Right Code",
      "role": "识图 Key",
      "channel": "Gemini (/gemini)",
      "model": "gemini-2.5-flash",
      "apiUrl": "https://right.codes/gemini",
      "configured": false,
      "keyPreview": ""
    },
    "text": {
      "provider": "DeepSeek",
      "role": "脚本 Key",
      "channel": "Chat Completions",
      "model": "deepseek-v4-pro",
      "apiUrl": "https://api.deepseek.com/chat/completions",
      "configured": false,
      "keyPreview": ""
    },
    "image": {
      "provider": "Right Code",
      "role": "生图 Key",
      "channel": "画图 (/draw)",
      "model": "gpt-image-2",
      "apiUrl": "https://www.right.codes/draw/v1/images/generations",
      "configured": false,
      "keyPreview": ""
    }
  }
}
```

Full API key values are never returned. In local-only development, the response
may include a short `keyPreview` such as `已保存 · 末尾 abcd` so the operator can
confirm which local token is responsible for each provider without exposing the
complete secret.

## Update Provider Keys

```http
PUT /api/settings/providers
Content-Type: application/json
```

Request:

```json
{
  "visionApiKey": "right-code-vision-key",
  "deepSeekApiKey": "official-deepseek-key",
  "imageApiKey": "right-code-image-key"
}
```

Rules:

- All three fields are optional and independent.
- Omitted fields keep their existing values.
- A non-empty string replaces the corresponding local key.
- `visionApiKey` writes only `VISION_MODEL_API_KEY`.
- `deepSeekApiKey` writes only `TEXT_MODEL_API_KEY`.
- `imageApiKey` writes only `IMAGE_MODEL_API_KEY`.
- Vision and image remain separate providers and endpoints, even when the user chooses to enter the same Right Code account key.
- `null` explicitly clears that provider key.
- Empty strings are invalid.
- Values are stored only in the ignored local `.env` file.
- System environment variables still take precedence over `.env`.

Success returns the same redacted shape as `GET /api/settings/providers`.

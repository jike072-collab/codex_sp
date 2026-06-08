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
      "model": "gemini-2.5-flash",
      "apiUrl": "https://www.right.codes/draw/v1/chat/completions",
      "configured": false
    },
    "text": {
      "provider": "DeepSeek",
      "model": "deepseek-v4-pro",
      "apiUrl": "https://api.deepseek.com/chat/completions",
      "configured": false
    },
    "image": {
      "provider": "Right Code",
      "model": "gpt-image-2",
      "apiUrl": "https://www.right.codes/draw/v1/images/generations",
      "configured": false
    }
  }
}
```

API key values are never returned.

## Update Provider Keys

```http
PUT /api/settings/providers
Content-Type: application/json
```

Request:

```json
{
  "rightCodesApiKey": "right-code-key-for-vision-and-image",
  "deepSeekApiKey": "official-deepseek-key"
}
```

Rules:

- Both fields are optional and independent.
- Omitted fields keep their existing values.
- A non-empty string replaces the corresponding local key.
- `rightCodesApiKey` writes both `VISION_MODEL_API_KEY` and `IMAGE_MODEL_API_KEY`.
- `deepSeekApiKey` writes only `TEXT_MODEL_API_KEY`.
- Right Code vision and image calls remain separate providers and endpoints even though they share one account key.
- Deprecated `visionApiKey` and `imageApiKey` request fields are accepted temporarily for stale browser pages and update both Right Code providers.
- `null` explicitly clears that provider key.
- Empty strings are invalid.
- Values are stored only in the ignored local `.env` file.
- System environment variables still take precedence over `.env`.

Success returns the same redacted shape as `GET /api/settings/providers`.

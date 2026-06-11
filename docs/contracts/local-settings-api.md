# Local Settings And Admin API

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

## Batch Delete Projects

```http
DELETE /api/projects
Content-Type: application/json
```

Request:

```json
{
  "projectIds": ["opaque-project-id", "another-project-id"]
}
```

Rules:

- Delete only the listed projects.
- Delete each selected project and its uploaded source-image directory.
- Return the ids that were deleted and the ids that were missing.
- Do not affect any other project.

Success:

```json
{
  "deletedProjectIds": ["opaque-project-id"],
  "missingProjectIds": ["another-project-id"]
}
```

## Public Provider Status

```http
GET /api/settings/providers/status
```

`GET /api/settings/providers` is kept as a compatibility alias for the same
public status shape. Public workbench surfaces must use this contract and must
not expose API keys, API URLs, model names, key previews, or editing controls.

Response:

```json
{
  "providers": {
    "vision": { "configured": false },
    "text": { "configured": true },
    "image": { "configured": false }
  },
  "configuredCount": 1,
  "total": 3
}
```

## Admin Provider Schema And Config

```http
GET /api/admin/providers
```

The Admin page renders from this backend-owned schema. Do not maintain a second
hard-coded provider list in the browser.

Full API key values are never returned.

Response:

```json
{
  "schemaVersion": 1,
  "providers": [
    {
      "id": "vision",
      "title": "识图模型",
      "provider": "Right Code",
      "role": "商品识别与产品锁定",
      "channel": "Gemini 识图通道",
      "fields": [
        {
          "name": "apiUrl",
          "label": "API 地址",
          "type": "url",
          "valueKey": "visionApiUrl",
          "clearable": false
        },
        {
          "name": "model",
          "label": "模型",
          "type": "select",
          "valueKey": "visionModel",
          "clearable": false
        },
        {
          "name": "apiKey",
          "label": "API Key",
          "type": "secret",
          "valueKey": "visionApiKey",
          "clearable": true
        }
      ],
      "config": {
        "model": "gemini-2.5-flash",
        "apiUrl": "https://right.codes/gemini",
        "configured": false,
        "keyPreview": "•••• 9744"
      }
    }
  ]
}
```

`keyPreview` is empty when no usable key is configured. Otherwise it is masked
as `•••• <last4>` and never contains the full API key.

## Admin Provider Model Discovery

```http
GET /api/admin/providers/models
GET /api/admin/providers/models?refresh=1
```

The backend attempts real provider model-list discovery through configured
provider endpoints and keys. It never invents models. Successful discoveries
may be cached briefly; `refresh=1` forces a new discovery attempt.

Response:

```json
{
  "providers": {
    "vision": {
      "status": "ok",
      "currentModel": "gemini-2.5-flash",
      "models": [
        { "id": "gemini-2.5-flash", "label": "gemini-2.5-flash" }
      ],
      "source": "provider"
    },
    "image": {
      "status": "unsupported",
      "currentModel": "gpt-image-2",
      "models": [
        { "id": "gpt-image-2", "label": "gpt-image-2" }
      ],
      "source": "current",
      "message": "供应商未提供可用的模型列表端点。"
    }
  }
}
```

Statuses:

- `ok`: models came from a real provider model-list response.
- `unsupported`: no supported model-list endpoint was available or the provider
  returned `404`/`405`; only the current configured model is returned.
- `error`: discovery failed safely; only the current configured model is
  returned.

No response includes a full API key, provider response body, prompt, image
content, or base64 payload.

## Update Admin Provider Settings

```http
PUT /api/admin/providers
Content-Type: application/json
```

Request fields are optional and independent:

```json
{
  "visionApiUrl": "https://right.codes/gemini",
  "visionModel": "gemini-2.5-flash",
  "visionApiKey": "right-code-vision-key",
  "textApiUrl": "https://api.deepseek.com/chat/completions",
  "textModel": "deepseek-v4-pro",
  "deepSeekApiKey": "official-deepseek-key",
  "imageApiUrl": "https://www.right.codes/draw/v1/images/generations",
  "imageModel": "gpt-image-2",
  "imageApiKey": "right-code-image-key"
}
```

Rules:

- `visionApiUrl`, `textApiUrl`, and `imageApiUrl` must be valid `http` or
  `https` URLs.
- `visionModel`, `textModel`, and `imageModel` must be non-empty strings with no
  line breaks.
- API key fields accept a non-empty string to replace the key.
- API key fields accept `null` to clear the local key.
- Omitted fields keep their current values.
- Empty API key strings are invalid; Admin UI should omit empty key inputs.
- Values are stored only in the ignored local `.env` file using atomic writes.
- System environment variables still take precedence over `.env`.
- Success returns the same shape as `GET /api/admin/providers`.

## Admin Static Page

```http
GET /admin/
```

Returns the standalone local Admin page. Files live under `studio-v2/admin/**`
and are not part of the ordinary five-step workbench under `studio-v2/public/**`.

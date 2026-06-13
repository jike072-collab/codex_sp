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
    "image": { "configured": false },
    "video": { "configured": true }
  },
  "configuredCount": 2,
  "total": 4
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
  "schemaVersion": 5,
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
    },
    {
      "id": "image",
      "title": "故事板图片模型",
      "provider": "Right Code",
      "role": "img2img 故事板生成",
      "channel": "双绘图通道",
      "channels": [
        {
          "id": "primary",
          "title": "绘图通道 A",
          "description": "固定用于 0-10s 故事板",
          "segmentId": "0-10s"
        },
        {
          "id": "secondary",
          "title": "绘图通道 B",
          "description": "固定用于 10-20s 故事板",
          "segmentId": "10-20s"
        }
      ],
      "fields": [
        {
          "name": "model",
          "label": "模型",
          "type": "select",
          "channelId": "primary",
          "valueKey": "imageModel",
          "clearable": false
        },
        {
          "name": "model",
          "label": "模型",
          "type": "select",
          "channelId": "secondary",
          "valueKey": "imageSecondaryModel",
          "clearable": false
        }
      ],
      "config": {
        "configured": false,
        "configuredChannels": 1,
        "requiredChannels": 2,
        "channels": [
          {
            "id": "primary",
            "title": "绘图通道 A",
            "segmentId": "0-10s",
            "model": "gpt-image-2",
            "apiUrl": "https://www.right.codes/draw/v1/images/generations",
            "configured": true,
            "keyPreview": "•••• 1111"
          },
          {
            "id": "secondary",
            "title": "绘图通道 B",
            "segmentId": "10-20s",
            "model": "gpt-image-2",
            "apiUrl": "https://www.right.codes/draw/v1/images/generations",
            "configured": false,
            "keyPreview": ""
          }
        ]
      }
    },
    {
      "id": "video",
      "title": "视频生成模型",
      "provider": "clmm-mall.top",
      "role": "Step 05 两段视频生成",
      "channel": "OpenAI-video 兼容通道",
      "fields": [
        {
          "name": "apiUrl",
          "label": "API 地址",
          "type": "url",
          "valueKey": "videoApiUrl",
          "clearable": false
        },
        {
          "name": "model",
          "label": "模型",
          "type": "select",
          "valueKey": "videoModel",
          "clearable": false
        },
        {
          "name": "apiKey",
          "label": "API Key",
          "type": "secret",
          "valueKey": "videoApiKey",
          "clearable": true
        }
      ],
      "config": {
        "model": "seedance2.0 720p-fast",
        "apiUrl": "https://clmm-mall.top/v1/videos/generations",
        "configured": false,
        "keyPreview": ""
      }
    }
  ]
}
```

`keyPreview` is empty when no usable key is configured. Otherwise it is masked
as `•••• <last4>` and never contains the full API key.

Schema version 5 also returns admin-only `config.profiles` arrays for preset
API URL choices. Each profile contains only `{ id, value, label, configured,
keyPreview, model }`; full keys are never returned. These profiles let the
Admin page switch between saved preset keys/models, for example Right Code and
Sub2API, without copying one provider key into another provider profile.

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
      "status": "partial",
      "source": "mixed",
      "channels": [
        {
          "id": "primary",
          "title": "绘图通道 A",
          "segmentId": "0-10s",
          "status": "ok",
          "currentModel": "gpt-image-2",
          "models": [
            { "id": "gpt-image-2", "label": "gpt-image-2" }
          ],
          "source": "provider"
        },
        {
          "id": "secondary",
          "title": "绘图通道 B",
          "segmentId": "10-20s",
          "status": "unsupported",
          "currentModel": "gpt-image-2",
          "models": [
            { "id": "gpt-image-2", "label": "gpt-image-2" }
          ],
          "source": "current",
          "message": "供应商未提供可用的模型列表端点。"
        }
      ]
    },
    "video": {
      "status": "ok",
      "currentModel": "seedance2.0 720p-fast",
      "models": [
        { "id": "seedance2.0 720p-fast", "label": "seedance2.0 720p-fast" }
      ],
      "source": "provider"
    }
  }
}
```

For `image`, model discovery is channel-specific because each storyboard draw
channel uses its own explicit key and endpoint. The backend never invents
channel models and never returns full API keys.

Statuses:

- `ok`: models came from a real provider model-list response.
- `unsupported`: no supported model-list endpoint was available or the provider
  returned `404`/`405`; only the current configured model is returned.
- `error`: discovery failed safely; only the current configured model is
  returned.
- `partial`: mixed channel results, for example one draw channel supports model
  discovery while the other only falls back to its current configured model.

For `video`, the backend derives `/models` from the configured
`/v1/videos/generations` endpoint and never invents unavailable models.

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
  "imageApiKey": "right-code-image-key-a",
  "imageSecondaryApiUrl": "https://www.right.codes/draw/v1/images/generations",
  "imageSecondaryModel": "gpt-image-2",
  "imageSecondaryApiKey": "right-code-image-key-b",
  "videoApiUrl": "https://clmm-mall.top/v1/videos/generations",
  "videoModel": "seedance2.0 720p-fast",
  "videoApiKey": "video-provider-key"
}
```

Rules:

- `visionApiUrl`, `textApiUrl`, `imageApiUrl`, and `imageSecondaryApiUrl` must
  be valid `http` or `https` URLs.
- `videoApiUrl` must also be a valid `http` or `https` URL.
- `visionModel`, `textModel`, `imageModel`, `imageSecondaryModel`, and
  `videoModel` must be non-empty strings with no line breaks.
- API key fields accept a non-empty string to replace the key.
- API key fields accept `null` to clear the local key for the currently selected
  preset profile.
- Omitted fields keep their current values.
- Empty API key strings are invalid; Admin UI should omit empty key inputs.
- Values are stored only in the ignored local `.env` file using atomic writes.
- `videoApiKey` is persisted to the dedicated `VIDEO_MODEL_API_KEY` setting.
- System environment variables still take precedence over `.env`.
- Preset API URL choices keep separate local profile keys/models using
  `ENV_KEY__PRESET_ID` names, while the existing runtime `ENV_KEY` values remain
  the source used by generation workflows.
- Success returns the same shape as `GET /api/admin/providers`.

## Admin Static Page

```http
GET /admin/
```

Returns the standalone local Admin page. Files live under `studio-v2/admin/**`
and are not part of the ordinary five-step workbench under `studio-v2/public/**`.

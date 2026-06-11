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
      "title": "Vision recognition",
      "provider": "Right Code",
      "role": "Product image analysis",
      "channel": "Gemini (/gemini)",
      "fields": [
        {
          "name": "apiUrl",
          "label": "API URL",
          "type": "url",
          "valueKey": "visionApiUrl",
          "clearable": false
        },
        {
          "name": "model",
          "label": "Model",
          "type": "text",
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
        "keyPreview": ""
      }
    }
  ]
}
```

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

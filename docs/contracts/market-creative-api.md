# Market Creative API Contract

This contract is shared by the `frontend`, `local-api`, and `workflow-domain` modules.

## Save Market Brief

```http
POST /api/projects/:projectId/market
Content-Type: application/json
```

Request:

```json
{
  "marketBrief": {
    "targetCountry": "Thailand",
    "audience": "日常运动与通勤人群",
    "creativeTheme": "city-motion",
    "coreMessage": "轻快、稳定，适合每天出发",
    "tone": "energetic"
  }
}
```

Rules:

- The project must exist.
- The current project status must be `market`.
- A confirmed `visionAnalysis` and `reviewConfirmedAt` must exist.
- All five market brief fields are required non-empty strings.
- `creativeTheme` must be one of:
  - `city-motion`
  - `daily-comfort`
  - `performance-detail`
  - `street-style`
- `tone` must be one of:
  - `energetic`
  - `clean`
  - `warm`
  - `bold`

Success:

```http
200 OK
```

```json
{
  "project": {
    "id": "opaque-project-id",
    "status": "script",
    "targetCountry": "Thailand",
    "audience": "日常运动与通勤人群",
    "marketBrief": {
      "targetCountry": "Thailand",
      "audience": "日常运动与通勤人群",
      "creativeTheme": "city-motion",
      "coreMessage": "轻快、稳定，适合每天出发",
      "tone": "energetic"
    },
    "marketConfirmedAt": "2026-06-06T00:00:00.000Z"
  }
}
```

The response contains the complete persisted project object; fields omitted in this example remain unchanged.

## Project Read Contract

Existing endpoint:

```http
GET /api/projects/:projectId
```

Once a market brief has been saved, the project includes:

```json
{
  "status": "script",
  "marketBrief": {
    "targetCountry": "Thailand",
    "audience": "日常运动与通勤人群",
    "creativeTheme": "city-motion",
    "coreMessage": "轻快、稳定，适合每天出发",
    "tone": "energetic"
  },
  "marketConfirmedAt": "2026-06-06T00:00:00.000Z"
}
```

## Errors

The current local API returns:

```json
{
  "error": "Human-readable message"
}
```

Expected statuses:

- `400`: invalid payload or invalid workflow transition
- `404`: project not found
- `405`: unsupported method
- `500`: unexpected local or provider error

The frontend should display `error` through the existing toast and must not infer success from a non-2xx response.


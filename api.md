# REST API

Public: GET /health and POST /api/auth/login (username/password).
All other /api endpoints require Authorization: Bearer token, except POST /api/telephony/events which uses a separate SHA256 HMAC hex signature in X-HROS-Signature.

GET /api/system: mode and active calls.
POST /api/candidates/preview: multipart form file .xlsx, optional mapping JSON. Returns validation errors per row.
POST /api/candidates/import: same multipart body, revalidates and atomically inserts only if every row is valid.
GET /api/candidates: candidate list.
GET /api/candidates/export: Excel download.
PATCH /api/candidates/:id/opt-out: JSON with opt_out true/false.
GET /api/candidates/:id/history: candidate call history.
GET /api/campaigns: list.
POST /api/campaigns: JSON name, job_role, language, retry_limit, scheduled_at (optional ISO offset).
PATCH /api/campaigns/:id/start: start from DRAFT or SCHEDULED.
PATCH /api/campaigns/:id/pause: stop new attempts.
PATCH /api/campaigns/:id/resume: continue a PAUSED campaign.
PATCH /api/campaigns/:id/cancel: cancel and end in-flight calls.
GET /api/campaigns/:id/calls: attempted calls.
GET /api/campaigns/:id/analytics: totals for answered, interested, not interested, no response, failures and simulated.
GET /api/campaigns/:id/export: Excel report.
GET /api/calls/:id: one call.
POST /api/calls/:id/retry: manual retry, still subject to retry limits and opt-out.
POST /api/telephony/events: securely ingest/deduplicate externally signed event_id/provider/type (not authoritative Asterisk call control).

Workbook column names: name, phone, email, location, role, consent, scenario. Preview rejects any duplicate phone, missing required column, bad email or false consent. Import is all-or-nothing. Supported mock scenarios: interested, not_interested, no_input, invalid, no_answer, busy, failed.

Create a campaign for the same job_role as imported candidates. Exact role comparison is case-insensitive.

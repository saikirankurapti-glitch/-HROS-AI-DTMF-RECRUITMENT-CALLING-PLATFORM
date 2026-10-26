# HROS Enterprise SaaS Frontend Redesign

## Scope

This UI improvement is committed directly to `feat/hros-mvp`; it preserves the existing Express API, SQLite migrations, telephony adapters, authentication, scheduler, Excel contracts, and no-public-calling default.

### Design system

- Professional light theme with neutral canvas, white surfaces, dark navy sidebar, restrained indigo actions, and semantic outcome colors.
- Inter typography with system fallbacks, consistent 4–16px spacing rhythm, subtle surface borders, accessible focus treatment, compact typography, skeleton loading, feedback banners and dialog/drawer patterns.
- Responsive shell with collapsing desktop sidebar, mobile navigation overlay, current-page highlighting, administrator dropdown, and explicit backend-derived provider-mode badge.

### Working pages

| Area | What changed | API backing |
|---|---|---|
| Overview | Candidate/campaign/call KPIs, answer rate, campaign-volume chart, status distribution, recent calls, quick actions | Candidates, campaigns, calls, per-campaign analytics, system |
| Candidates | Search name/email/phone/role, role + consent/opt-out filters, sortable and paginated directory, masked phone numbers, Excel preview/import, column mapping, drawer with candidate history, opt-out confirmation and export | Existing candidate import/list/export/opt-out/history endpoints |
| Campaigns | Search, status filters, candidate matching preview, create form, schedule/retry fields, assigned count, role targeting, status/progress, confirmed start/pause/resume/cancel, latest attempts and Excel export | Existing campaign lifecycle and calls/analytics endpoints |
| Live Calls | Polling monitor with actively stored states, provider mode, simulated flag, last attempts | System and campaign calls |
| Call History | Search, campaign/status/outcome/UTC-date filters, ordering, pagination, details drawer, retry confirmation | Existing calls and retry endpoints |
| Analytics & Reports | Answer and interest rate calculations, outcome distribution, campaign-volume comparison, campaign exports | Existing campaign calls/analytics/export and candidate export |
| Integrations / Telephony | Read-only provider state and documented Asterisk/manual SIP setup, no nonfunctional test toggles | Existing system endpoint |
| Settings | Current admin session, backend operational settings, documentation, sign-out | Existing sign-in/token/system data |

### Metric definitions

- Total candidates: length of the current candidate directory API response. Backend currently caps candidate listing at 10,000 rows; this is a limitation for large deployments.
- Active campaigns: campaigns whose current backend status is RUNNING.
- Calls attempted: number of persisted call-attempt records across all campaigns, including retries.
- Answered calls: persisted attempts with a non-null answered_at timestamp.
- Interested: attempts with dtmf_response = INTERESTED.
- Answer rate: answered attempts divided by all attempted calls, 0% if none.
- Interest rate: interested responses divided by answered calls, 0% if none.
- Campaign contacted progress: unique candidates with a terminal call attempt divided by campaign-assigned candidates; not a hiring conversion metric.
- Campaign performance / status distribution: persisted campaign/call records only.
- Live monitor: 12-second polling, **not** real-time streaming. Statuses and provider details reflect only what the backend actually recorded.
- Unknown/no backend response is never replaced with fabricated call data. Missing data is represented by zero/empty states or connection errors.

### Safeguards and behavior

- The frontend does not change server credentials, SIP trunk routes, consent enforcement, retry limits, or public-dial permission.
- Candidate phone numbers are masked in tables; an authenticated user must open a detail view to inspect the full number.
- Destructive and calling-related actions require confirmation. API errors are surfaced, and submissions are blocked while requests run.
- No cosmetic switches for fake functionality. Telephony status is explicitly read-only; a configured Asterisk adapter is **not** represented as proof that real calls work.
- Responsive tables can scroll horizontally inside their panels; desktop sidebar collapses and mobile navigation uses an overlay.

## Changed / added files

- `web/src/App.tsx` — authentication and page orchestration.
- `web/src/styles.css` — design tokens, desktop/tablet/mobile layout, component styles and skeletons.
- `web/src/lib/client.ts` — typed API client and formatting helpers.
- `web/src/lib/useWorkspace.ts` — API-backed polling, aggregation, and error handling.
- `web/src/components/ui.tsx` — shared buttons, statuses, dialogs, drawers, metrics, sorting and pagination.
- `web/src/components/Shell.tsx` — navigation and environment indicator.
- `web/src/pages/Overview.tsx`, `Candidates.tsx`, `Campaigns.tsx`, `Calls.tsx`, `Analytics.tsx`, `TelephonySettings.tsx` — functional page modules.
- `web/src/App.test.tsx` and `web/tests/hros.e2e.ts` — updated authentication/UI, data correctness, confirmation and mobile navigation tests.

## Validation commands

Run on Node 22+ with a real `.env` where required:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run e2e --workspace=web
docker compose config
docker compose up --build -d api web
```

GitHub Actions workflow also validates Docker Compose, starts the safe mock-only API and web services, and checks both HTTP endpoints. **Consult the latest run for verified results**; do not assume local environment or live SIP tests passed.

## Remaining limitations

- Asterisk softphone calls, sound playback completion, call disconnect handling, and authorized SIP trunk have not been verified by this frontend redesign.
- Polling loads calls and analytics from each existing campaign; large tenants require paginated, queryable backend analytics rather than fetching everything.
- Only one environment-backed administrator account exists, without production SSO/MFA/RBAC.
- The existing backend candidate list caps responses at 10,000 and does not offer server pagination/search.
- The system remains a controlled MVP; telecom and privacy compliance and Asterisk hardening require independent work.

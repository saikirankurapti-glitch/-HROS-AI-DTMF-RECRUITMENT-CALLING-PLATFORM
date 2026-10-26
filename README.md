# HROS Recruitment DTMF Calling Platform

Full-stack recruitment screening application: React + TypeScript + Vite, Express + TypeScript, SQLite (persistent Docker volume), ExcelJS, deterministic mock telephony, and optional Asterisk ARI / local SIP.

**Safety:** mock calling by default. No real public calls are placed without deliberate administrator configuration, legal authorization, and an approved SIP trunk.

## Quick start (Docker)

Requirements: Docker Desktop / Docker Compose v2.

1. Clone the repository and check out the feature branch:
   git clone https://github.com/saikirankurapti-glitch/-HROS-AI-DTMF-RECRUITMENT-CALLING-PLATFORM.git
   cd ./-HROS-AI-DTMF-RECRUITMENT-CALLING-PLATFORM
   git checkout feat/hros-mvp
2. Copy .env.example to .env.
3. Replace HROS_PASSWORD with a unique strong password; replace SESSION_SECRET with 32+ random characters.
4. Run: docker compose config
5. Run: docker compose up --build -d
6. Run: docker compose ps
7. Open http://localhost:8080 and log in as admin, using HROS_PASSWORD.

Backend health: http://localhost:3001/health. Both ports are bound to localhost.

## Quick start (Node without Docker)

Node 22.13+ and npm are required. Create a .env from the example, set secure values, then on POSIX shells run:
  npm ci
  set -a; . ./.env; set +a
  npm run dev

The web UI starts at http://localhost:5173, backend at http://localhost:3001. SQLite DB lives at DATABASE_PATH or ./data/hros.db.

## First mock campaign

- Run: npm run sample:excel --workspace=server
- Import hros-sample-candidates.xlsx (fictional candidates; invalid routing numbers; never use for real calling).
- Preview every row and import the workbook.
- Create a new campaign for role "Data Engineer" and click Start.
- DTMF scenario 1 = interested, 2 = not interested; no response, busy, no answer and failed are recorded distinctly.
- Review analytics and export campaign results to Excel; each result has a simulated flag.
- Edit retry limit / candidate opt-outs to verify suppression behavior.

## Verify development

  npm ci
  npm run lint
  npm run typecheck
  npm test
  npm run build
  docker compose config
  docker compose up --build -d

See the actual GitHub Actions logs. Real SIP calling and local Docker execution have not been verified in the authoring environment.

## Source map

- server/src/app.ts : Express API and route authentication
- server/src/engine.ts : persistent scheduler, call state machine, retries, campaign actions
- server/src/telephony.ts : MockTelephonyProvider and AsteriskTelephonyProvider
- server/src/db.ts and server/migrations : SQLite storage
- server/src/excel.ts : candidate validation, import, and report exports
- web/src : responsive React dashboard
- asterisk : ARI / PJSIP config for local softphone testing (Compose profile "sip")
- docs : API, architecture, telephony, compliance, troubleshooting
- .github/workflows/ci.yml : CI test/build workflow

## Production constraints

Single-process SQLite scheduling is not safe for horizontal scaling. Use PostgreSQL and durable distributed task locks for multiple workers. Asterisk media currently waits a fixed delay instead of PlaybackFinished; reliable media event synchronization, reconnect/reconciliation, authorized trunk testing, full data security, external TLS, DND/consent validation, scheduled calling windows and role-based authorization must be completed before real bulk calling.

Pause stops new attempts; in-flight attempts can finish. Cancel attempts to hang up active calls. Campaign candidate membership is taken at campaign creation, so import candidates first.

Documentation:
- docs/api.md
- docs/telephony.md
- docs/compliance.md
- docs/troubleshooting.md
- docs/architecture.mmd

## Enterprise UI redesign

The HROS frontend has a responsive enterprise interface with eight connected navigation views, API-backed KPIs/charts, candidate CRM, campaign confirmations, a polling monitor, history/exports, and read-only telephony/settings. See [UI redesign notes](docs/UI_REDESIGN.md) for metric definitions, file changes, testing and current limitations.

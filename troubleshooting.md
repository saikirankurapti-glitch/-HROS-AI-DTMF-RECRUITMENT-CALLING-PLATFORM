# Troubleshooting

No Docker: install Docker Desktop/Compose V2, run docker compose config and docker compose up --build -d locally.
Login fails: set HROS_PASSWORD and SESSION_SECRET in .env; do not retain example placeholders.
Excel rejected: use .xlsx under 5 MB with required header names and consent yes; resolve all preview row errors.
No candidates assigned: job_role must match existing imported candidate role exactly (case-insensitive). Import first.
No mock calls: verify TELEPHONY_MODE=mock, click Start, see docker compose logs api.
All analytics zero: the app records actual mock operations, not seeded fake analytics. Start the campaign and wait for scheduler tick.
Retry not triggering: only BUSY/NO_ANSWER/FAILED are retried, after 30-second exponential backoff and while allowed by retry_limit. Opt-outs block further attempts.
SIP registration fails: verify softphone UDP config, extension password and Asterisk PJSIP contacts.
No audio: install the correct mono WAV files, verify mounted path and ARI sound namespace.
Public destination blocked: this is intended. Never bypass authorization restrictions.
SQLite locked: run one scheduler instance; PostgreSQL migration required for multiple replicas.
No npm lockfile: run npm install and commit generated package-lock.json; GitHub CI will attempt to generate/commit it automatically on feature branch.

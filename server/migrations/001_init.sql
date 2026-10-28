PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS candidates (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 phone TEXT NOT NULL UNIQUE,
 email TEXT NOT NULL,
 location TEXT NOT NULL DEFAULT '',
 role TEXT NOT NULL,
 scenario TEXT NOT NULL DEFAULT 'interested',
 consent INTEGER NOT NULL DEFAULT 0 CHECK(consent IN (0,1)),
 consent_at TEXT,
 consent_source TEXT,
 opt_out INTEGER NOT NULL DEFAULT 0 CHECK(opt_out IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_candidate_role ON candidates(role,opt_out,consent);
CREATE TABLE IF NOT EXISTS campaigns (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 job_role TEXT NOT NULL,
 language TEXT NOT NULL DEFAULT 'en',
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SCHEDULED','RUNNING','PAUSED','COMPLETED','CANCELLED')),
 retry_limit INTEGER NOT NULL DEFAULT 1 CHECK(retry_limit BETWEEN 0 AND 5),
 scheduled_at TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS campaign_candidates (
 campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 candidate_id INTEGER NOT NULL REFERENCES candidates(id),
 PRIMARY KEY(campaign_id,candidate_id)
);
CREATE TABLE IF NOT EXISTS calls (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
 candidate_id INTEGER NOT NULL REFERENCES candidates(id),
 provider TEXT NOT NULL, provider_call_id TEXT UNIQUE,
 status TEXT NOT NULL DEFAULT 'INIT',
 dtmf_response TEXT CHECK(dtmf_response IN ('INTERESTED','NOT_INTERESTED','NO_RESPONSE') OR dtmf_response IS NULL),
 attempt_number INTEGER NOT NULL DEFAULT 1,
 started_at TEXT NOT NULL DEFAULT (datetime('now')),
 answered_at TEXT, ended_at TEXT, duration_seconds INTEGER,
 error_message TEXT,
 simulated INTEGER NOT NULL DEFAULT 1 CHECK(simulated IN (0,1)),
 UNIQUE(campaign_id,candidate_id,attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_calls_campaign ON calls(campaign_id,status);
CREATE INDEX IF NOT EXISTS idx_calls_candidate ON calls(candidate_id,started_at);
CREATE TABLE IF NOT EXISTS processed_events (
 provider TEXT NOT NULL, event_id TEXT NOT NULL, seen_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(provider,event_id)
);
CREATE TABLE IF NOT EXISTS audit_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL,
 entity_type TEXT NOT NULL, entity_id INTEGER, details TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

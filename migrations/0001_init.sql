CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  visitor_id TEXT,
  session_id TEXT,
  event TEXT NOT NULL,
  props TEXT,
  path TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  country TEXT,
  city TEXT,
  asn_org TEXT,
  ip_hash TEXT,
  ua TEXT
);
CREATE INDEX idx_events_visitor ON events(visitor_id);
CREATE INDEX idx_events_ts ON events(ts);
CREATE INDEX idx_events_event ON events(event);
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  visitor_id TEXT,
  name TEXT,
  email TEXT,
  company TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  intent_score INTEGER,
  country TEXT,
  city TEXT,
  asn_org TEXT
);
CREATE INDEX idx_leads_status ON leads(status);

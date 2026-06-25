CREATE TABLE outreach (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_ts INTEGER NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  company TEXT,
  title TEXT,
  industry TEXT,
  emp TEXT,
  city TEXT,
  subject TEXT,
  body TEXT,
  persona TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sent_ts INTEGER,
  error TEXT
);
CREATE UNIQUE INDEX idx_outreach_email ON outreach(email);
CREATE INDEX idx_outreach_status ON outreach(status);

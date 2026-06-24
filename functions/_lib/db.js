const EVENT_COLS = [
  "ts", "visitor_id", "session_id", "event", "props", "path", "referrer",
  "utm_source", "utm_medium", "utm_campaign", "country", "city", "asn_org", "ip_hash", "ua",
];

export async function insertEvents(DB, rows) {
  if (!rows.length) return;
  const placeholders = "(" + EVENT_COLS.map(() => "?").join(",") + ")";
  const sql = `INSERT INTO events (${EVENT_COLS.join(",")}) VALUES ${placeholders}`;
  const stmts = rows.map((r) => DB.prepare(sql).bind(...EVENT_COLS.map((c) => r[c] ?? null)));
  await DB.batch(stmts);
}

export async function eventsForVisitor(DB, visitor_id) {
  const { results } = await DB
    .prepare("SELECT event, props, ts FROM events WHERE visitor_id = ? ORDER BY ts ASC")
    .bind(visitor_id).all();
  return results;
}

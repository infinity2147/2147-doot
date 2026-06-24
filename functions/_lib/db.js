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

const LEAD_COLS = ["ts","visitor_id","name","email","company","message","status","intent_score","country","city","asn_org"];

export async function insertLead(DB, lead) {
  const sql = `INSERT INTO leads (${LEAD_COLS.join(",")}) VALUES (${LEAD_COLS.map(() => "?").join(",")})`;
  const res = await DB.prepare(sql).bind(...LEAD_COLS.map((c) => lead[c] ?? null)).run();
  return res.meta.last_row_id;
}

export async function overview(DB, sinceTs) {
  const byEvent = await DB.prepare("SELECT event, count(*) n FROM events WHERE ts >= ? GROUP BY event").bind(sinceTs).all();
  const counts = await DB.prepare(
    "SELECT count(DISTINCT visitor_id) visitors, count(DISTINCT session_id) sessions FROM events WHERE ts >= ?"
  ).bind(sinceTs).first();
  const conv = await DB.prepare("SELECT count(*) c FROM events WHERE ts >= ? AND event='form_submit'").bind(sinceTs).first();
  const topCountries = await DB.prepare(
    "SELECT country, count(DISTINCT visitor_id) n FROM events WHERE ts >= ? AND country IS NOT NULL GROUP BY country ORDER BY n DESC LIMIT 8"
  ).bind(sinceTs).all();
  const by_event = {};
  for (const r of byEvent.results) by_event[r.event] = r.n;
  return {
    sessions: counts.sessions || 0,
    visitors: counts.visitors || 0,
    conversions: conv.c || 0,
    by_event,
    top_countries: topCountries.results,
  };
}

export async function listLeads(DB) {
  const { results } = await DB.prepare("SELECT * FROM leads ORDER BY ts DESC LIMIT 500").all();
  return results;
}

export async function leadById(DB, id) {
  const lead = await DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first();
  let timeline = [];
  if (lead && lead.visitor_id) {
    const { results } = await DB.prepare("SELECT event, props, ts FROM events WHERE visitor_id = ? ORDER BY ts ASC").bind(lead.visitor_id).all();
    timeline = results;
  }
  return { lead, timeline };
}

export async function updateLead(DB, id, fields) {
  const sets = [], vals = [];
  if (typeof fields.status === "string") { sets.push("status = ?"); vals.push(fields.status); }
  if (typeof fields.company === "string") { sets.push("company = ?"); vals.push(fields.company); }
  if (!sets.length) return;
  vals.push(id);
  await DB.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
}

export async function listVisitors(DB, sinceTs) {
  const { results } = await DB.prepare(
    `SELECT visitor_id, count(*) events, max(ts) last_ts,
            max(country) country, max(city) city, max(asn_org) asn_org
     FROM events WHERE ts >= ? GROUP BY visitor_id ORDER BY last_ts DESC LIMIT 300`
  ).bind(sinceTs).all();
  return results;
}

export async function listEvents(DB, { event, visitor_id, sinceTs = 0, limit = 200 }) {
  let sql = "SELECT * FROM events WHERE ts >= ?";
  const vals = [sinceTs];
  if (event) { sql += " AND event = ?"; vals.push(event); }
  if (visitor_id) { sql += " AND visitor_id = ?"; vals.push(visitor_id); }
  sql += " ORDER BY ts DESC LIMIT ?";
  vals.push(limit);
  const { results } = await DB.prepare(sql).bind(...vals).all();
  return results;
}

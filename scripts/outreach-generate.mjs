// Generate personalized outreach drafts from the Apollo CSVs and load them into
// the local DB via the admin import endpoint.
//   Prereq: `npm run dev` is running (default http://localhost:8788).
//   Run:    node scripts/outreach-generate.mjs
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.DOOT_BASE || "http://localhost:8788";
const LEADS_DIR = path.resolve("leads_data");

function parseCSV(t) {
  const rows = []; let i = 0, f = "", row = [], q = false;
  while (i < t.length) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
      else if (c === "\r") { /* skip */ }
      else f += c;
    }
    i++;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const firstName = (f) => ((f || "there").trim().split(/\s+/)[0]) || "there";
const SIG = 'Anant — AI engineer, IIT Bombay\nNot relevant? Just reply "no" and I\'ll stop.';

function draft({ first, company, industry, emp }) {
  const n = parseInt((emp || "").replace(/[^0-9]/g, ""), 10) || 0;
  const ind = (industry || "").toLowerCase();
  const sizeLine = n < 30 ? "pipeline before you can afford an SDR" : "more client meetings without adding to your team";

  if (ind.includes("staffing") || ind.includes("recruit")) {
    return {
      persona: "staffing",
      subject: `quick one for ${company}`,
      body: `Hi ${first},\n\nReaching out because ${company} is in staffing — and winning new clients usually means outbound that eats your team's week.\n\nDoot is an AI sales agent: it finds the right companies, writes a real email to the person who can say yes, sends it, and follows up. This email? Written and sent by that agent.\n\nFor a staffing firm that means ${sizeLine}.\n\nWorth a 10-min look?\n\n${SIG}`,
    };
  }
  if (ind.includes("marketing") || ind.includes("advertis") || ind.includes("public relations") || ind.includes("media")) {
    return {
      persona: "marketing",
      subject: `your outbound, on autopilot`,
      body: `Hi ${first},\n\n${company} sells outbound for a living — so you know how much research and writing goes into emails that still get ignored.\n\nDoot is an AI agent that does the discovery, personalizes every email, sends, and follows up. You could even run it for your own clients, under your brand. This message was written and sent by that agent.\n\nWorth a quick look?\n\n${SIG}`,
    };
  }
  return {
    persona: "general",
    subject: `quick one for ${company}`,
    body: `Hi ${first},\n\nOutbound — finding the right companies, writing a real email, following up — usually eats more time than it should.\n\nDoot is an AI sales agent that does all of it on its own, from your inbox. This email was written and sent by that agent — that's the demo.\n\nFor ${company} that means ${sizeLine}.\n\nWorth a 10-min look?\n\n${SIG}`,
  };
}

const files = fs.readdirSync(LEADS_DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
const seen = new Set();
const items = [];
for (const fn of files) {
  const rows = parseCSV(fs.readFileSync(path.join(LEADS_DIR, fn), "utf8"));
  const h = rows[0]; const idx = (n) => h.indexOf(n);
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]; if (!row[0]) continue;
    const email = (row[idx("Email")] || "").trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    const rec = {
      first: firstName(row[idx("First Name")]),
      name: `${row[idx("First Name")] || ""} ${row[idx("Last Name")] || ""}`.trim(),
      company: (row[idx("Company Name")] || "your company").trim(),
      title: row[idx("Title")] || "",
      industry: row[idx("Industry")] || "",
      emp: row[idx("# Employees")] || "",
      city: row[idx("City")] || "",
    };
    const d = draft(rec);
    items.push({
      created_ts: Date.now(), email, name: rec.name, company: rec.company, title: rec.title,
      industry: rec.industry, emp: rec.emp, city: rec.city,
      subject: d.subject, body: d.body, persona: d.persona, status: "draft",
    });
  }
}

console.log(`Parsed ${items.length} unique leads from ${files.length} file(s). Importing to ${BASE} ...`);
const res = await fetch(`${BASE}/admin/api/outreach`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ items }),
});
if (!res.ok) { console.error("Import failed:", res.status, await res.text()); process.exit(1); }
const j = await res.json();
console.log(`Imported ${j.inserted} new draft(s) (received ${j.received}; duplicates ignored).`);
console.log(`Review them in the local admin → Outreach tab (${BASE}/admin/).`);

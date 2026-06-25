// Send approved outreach drafts via Gmail (app password).
//
//   TEST (default): sends up to 2 approved drafts to your TEST_TO inbox,
//                   subject prefixed [TEST], does NOT touch their status.
//     node scripts/outreach-send.mjs
//
//   LIVE: sends ALL approved drafts to the real recipients, paced, and marks
//         each 'sent' (or 'failed'). Requires both flags so it can't fire by accident:
//     node scripts/outreach-send.mjs --live --confirm
//
// Config (env vars, or a gitignored .outreach.env file of KEY=VALUE lines):
//   GMAIL_USER            the Gmail address you send FROM (e.g. asatianant2678@gmail.com)
//   GMAIL_APP_PASSWORD    16-char Google app password (Account → Security → App passwords)
//   TEST_TO               where test sends go (default coder2675@gmail.com)
//   FROM_NAME             display name (default "Anant")
//   SEND_DELAY_MS         gap between live sends (default 45000 = 45s)
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.DOOT_BASE || "http://localhost:8788";
const args = process.argv.slice(2);
const LIVE = args.includes("--live") && args.includes("--confirm");
const WANTS_LIVE = args.includes("--live");

// load .outreach.env if present (does not override real env vars)
const envFile = path.resolve(".outreach.env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
const TEST_TO = process.env.TEST_TO || "coder2675@gmail.com";
const FROM_NAME = process.env.FROM_NAME || "Anant";
const DELAY = Number(process.env.SEND_DELAY_MS || 45000);
const TEST_LIMIT = Number(process.env.TEST_LIMIT || 2);

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error("Missing GMAIL_USER / GMAIL_APP_PASSWORD. Put them in .outreach.env or export them. See script header.");
  process.exit(1);
}
if (WANTS_LIVE && !LIVE) {
  console.error("Refusing to send live without explicit confirmation. Re-run with:  --live --confirm");
  process.exit(1);
}

let nodemailer;
try { nodemailer = (await import("nodemailer")).default; }
catch { console.error("nodemailer not installed. Run:  npm i nodemailer"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${BASE}/admin/api/outreach?status=approved`);
if (!res.ok) { console.error("Could not fetch approved drafts:", res.status, "(is `npm run dev` running?)"); process.exit(1); }
let approved = (await res.json()).items || [];
if (!approved.length) { console.log("No drafts in 'approved' status. Approve some in the admin → Outreach tab first."); process.exit(0); }

const transport = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });

if (!LIVE) {
  const sample = approved.slice(0, TEST_LIMIT);
  console.log(`TEST MODE — sending ${sample.length} of ${approved.length} approved draft(s) to ${TEST_TO} (status untouched).`);
  for (const x of sample) {
    try {
      await transport.sendMail({
        from: `"${FROM_NAME}" <${GMAIL_USER}>`, to: TEST_TO,
        subject: `[TEST → ${x.email}] ${x.subject}`, text: x.body,
      });
      console.log(`  ✓ test sent: ${x.company} (would go to ${x.email})`);
    } catch (e) { console.log(`  ✗ test FAILED: ${x.company} — ${e.message}`); }
  }
  console.log(`\nCheck ${TEST_TO}. Looks right? Send for real with:  node scripts/outreach-send.mjs --live --confirm`);
  process.exit(0);
}

// LIVE
console.log(`LIVE — sending ${approved.length} approved draft(s) to REAL recipients, from ${GMAIL_USER}, ~${DELAY / 1000}s apart.`);
let ok = 0, fail = 0;
for (let i = 0; i < approved.length; i++) {
  const x = approved[i];
  try {
    await transport.sendMail({ from: `"${FROM_NAME}" <${GMAIL_USER}>`, to: x.email, subject: x.subject, text: x.body });
    await fetch(`${BASE}/admin/api/outreach/${x.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "sent", sent_ts: Date.now(), error: null }) });
    ok++; console.log(`  ✓ [${i + 1}/${approved.length}] sent to ${x.email} (${x.company})`);
  } catch (e) {
    fail++; await fetch(`${BASE}/admin/api/outreach/${x.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "failed", error: String(e.message).slice(0, 200) }) });
    console.log(`  ✗ [${i + 1}/${approved.length}] FAILED ${x.email} — ${e.message}`);
  }
  if (i < approved.length - 1) await sleep(DELAY);
}
console.log(`\nDone. Sent ${ok}, failed ${fail}. Watch ${GMAIL_USER} for replies.`);

# Doot Analytics + Lead Capture + Admin Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a free, self-hosted analytics + lead-capture + admin system on Cloudflare so every meaningful interaction is stored, visitors are profiled and intent-scored, leads are captured on-page, and everything is observable in a private dashboard.

**Architecture:** One Cloudflare Pages project hosts `doot.html` and Pages Functions (`/api/*`, `/admin/*`). Events are batched client-side and beaconed to `POST /api/track`; the form posts to `POST /api/lead`. Both write to a D1 (SQLite) database. The admin panel is a static page + JSON endpoints under `/admin`, gated by Cloudflare Access. Pure logic (validation, enrichment, domain parsing, intent scoring, DB queries) lives in small, individually-tested modules under `functions/_lib`.

**Tech Stack:** Cloudflare Pages + Pages Functions + D1 + Cloudflare Access; `wrangler` CLI; `vitest` + `@cloudflare/vitest-pool-workers` for tests; vanilla JS (no framework, no build step).

## Global Constraints

- **$0 / free tier only.** No paid APIs, no credit card. Scales to zero.
- **First-party only.** No third-party trackers required. Optional gtag/posthog/clarity hooks may remain but must not be a dependency.
- **Never store raw IP.** Store `sha256(ip + IP_SALT)` only; coarse geo (country/city) + ASN org only.
- **PII (name/email) only via voluntary form submit.** All `/admin/*` routes behind Cloudflare Access.
- **Allowed event names (exact set):** `page_view`, `cta_click`, `nav_click`, `scroll_depth`, `section_view`, `faq_open`, `demo_view`, `demo_step`, `time_on_page`, `slot_booked`, `form_start`, `form_submit`, `mailto_click`, `return_visit`.
- **`/api/track` limits:** body ≤ 16 KB, ≤ 50 events/batch.
- **Intent weights (exact):** pricing FAQ +30 (else any FAQ +10); demo_step max ≥ 2 → +15; scroll 100% +15; time > 120s +20; return_visit +25; cta_click +20; form_submit +100. Buckets: 0–30 cold, 31–70 warm, 71+ hot.
- **Lead status values (exact):** `new`, `replied`, `booked`, `closed`.
- **TDD, DRY, YAGNI, frequent commits.**

---

## File Structure

```
ramdoot/
  doot.html                         # MODIFY: add form + reference analytics client
  wrangler.toml                     # CREATE: Pages + D1 binding
  package.json                      # CREATE: scripts + dev deps
  vitest.config.js                  # CREATE: workers pool + D1
  .dev.vars                         # CREATE (gitignored): local IP_SALT, SITE_ORIGIN
  .gitignore                        # CREATE
  migrations/
    0001_init.sql                   # CREATE: events + leads tables
  assets/
    doot-analytics.js               # CREATE: client analytics (visitor id, queue, beacon)
  admin/
    index.html                      # CREATE: admin dashboard UI (static, Access-gated)
  functions/
    _lib/
      enrich.js                     # CREATE: hashIp, geoFromRequest
      validate.js                   # CREATE: validateBatch
      domain.js                     # CREATE: companyFromEmail
      intent.js                     # CREATE: intentScore
      db.js                         # CREATE (grown across tasks): all D1 queries
      cors.js                       # CREATE: corsHeaders
    api/
      track.js                      # CREATE: POST /api/track
      lead.js                       # CREATE: POST /api/lead
    admin/
      api/
        overview.js                 # CREATE: GET /admin/api/overview
        leads.js                    # CREATE: GET /admin/api/leads
        visitors.js                 # CREATE: GET /admin/api/visitors
        events.js                   # CREATE: GET /admin/api/events
        lead/
          [id].js                   # CREATE: GET + PATCH /admin/api/lead/:id
  test/
    helpers/applySchema.js          # CREATE: apply migration DDL to a test D1
    enrich.test.js
    validate.test.js
    domain.test.js
    intent.test.js
    db.test.js
    api-track.test.js
    api-lead.test.js
    admin-api.test.js
    client-analytics.test.js
```

---

## Phase 0 — Scaffold

### Task 1: Project tooling + git

**Files:**
- Create: `package.json`, `wrangler.toml`, `vitest.config.js`, `.gitignore`, `.dev.vars`

**Interfaces:**
- Produces: npm scripts `test`, `dev`, `db:migrate:local`; D1 binding name `DB`; env vars `IP_SALT`, `SITE_ORIGIN`.

- [ ] **Step 1: Initialize git** (folder is not yet a repo)

```bash
cd /Users/anantasati/Desktop/ramdoot
git init
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.dev.vars
.wrangler/
dist/
*.log
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "doot",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "wrangler pages dev",
    "db:migrate:local": "wrangler d1 migrations apply doot-analytics --local",
    "db:migrate:remote": "wrangler d1 migrations apply doot-analytics --remote",
    "deploy": "wrangler pages deploy"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.90.0"
  }
}
```

- [ ] **Step 4: Create `wrangler.toml`** (the `database_id` is filled in Task 2)

```toml
name = "doot"
compatibility_date = "2026-06-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "."

[vars]
SITE_ORIGIN = "http://localhost:8788"

[[d1_databases]]
binding = "DB"
database_name = "doot-analytics"
database_id = "REPLACE_AFTER_CREATE"
```

- [ ] **Step 5: Create `.dev.vars`** (local-only secrets; gitignored)

```
IP_SALT = "local-dev-salt-change-me"
SITE_ORIGIN = "http://localhost:8788"
```

- [ ] **Step 6: Create `vitest.config.js`**

```js
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: "2026-06-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: { DB: "test-db" },
          bindings: { IP_SALT: "test-salt", SITE_ORIGIN: "http://localhost:8788" },
        },
      },
    },
  },
});
```

- [ ] **Step 7: Install + verify tooling boots**

Run: `npm install && npx vitest run`
Expected: install succeeds; vitest reports "No test files found" (exit 0 or 1 with that message — acceptable, no tests yet).

- [ ] **Step 8: Commit**

```bash
git add .gitignore package.json package-lock.json wrangler.toml vitest.config.js
git commit -m "chore: scaffold Cloudflare Pages + D1 + vitest tooling"
```

---

### Task 2: D1 database + schema migration

**Files:**
- Create: `migrations/0001_init.sql`, `test/helpers/applySchema.js`, `test/db.test.js` (schema check)

**Interfaces:**
- Produces: tables `events` and `leads` per spec §6; `applySchema(DB)` test helper that applies the migration DDL to a test D1.

- [ ] **Step 1: Write `migrations/0001_init.sql`** (single source of truth for schema)

```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  visitor_id TEXT NOT NULL,
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
```

- [ ] **Step 2: Write the test helper `test/helpers/applySchema.js`**

```js
import schema from "../../migrations/0001_init.sql?raw";

export async function applySchema(DB) {
  const stmts = schema.split(";").map((s) => s.trim()).filter(Boolean);
  await DB.batch(stmts.map((s) => DB.prepare(s)));
}
```

- [ ] **Step 3: Write the failing schema test `test/db.test.js`**

```js
import { env } from "cloudflare:test";
import { beforeAll, expect, test } from "vitest";
import { applySchema } from "./helpers/applySchema.js";

beforeAll(async () => { await applySchema(env.DB); });

test("schema creates events and leads tables", async () => {
  const { results } = await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all();
  const names = results.map((r) => r.name);
  expect(names).toContain("events");
  expect(names).toContain("leads");
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/db.test.js`
Expected: PASS (the workers pool provides `env.DB`; the helper applies the DDL).

- [ ] **Step 5: Create the real D1 database (remote) and wire its id**

Run: `npx wrangler d1 create doot-analytics`
Then copy the printed `database_id` into `wrangler.toml` (replacing `REPLACE_AFTER_CREATE`).
Run: `npm run db:migrate:local` (applies `0001_init.sql` to the local dev D1).
Expected: "Migrations applied".

- [ ] **Step 6: Commit**

```bash
git add migrations/0001_init.sql test/helpers/applySchema.js test/db.test.js wrangler.toml
git commit -m "feat: D1 schema (events + leads) with migration and schema test"
```

---

## Phase 1 — Collection

### Task 3: Enrichment module (`enrich.js`)

**Files:**
- Create: `functions/_lib/enrich.js`, `test/enrich.test.js`

**Interfaces:**
- Produces: `hashIp(ip, salt) -> Promise<string>` (sha256 hex); `geoFromRequest(request) -> { country, city, asn_org }` (nulls when `request.cf` absent).

- [ ] **Step 1: Write the failing test `test/enrich.test.js`**

```js
import { expect, test } from "vitest";
import { geoFromRequest, hashIp } from "../functions/_lib/enrich.js";

test("hashIp returns a 64-char hex sha256 and is deterministic", async () => {
  const a = await hashIp("1.2.3.4", "salt");
  const b = await hashIp("1.2.3.4", "salt");
  expect(a).toMatch(/^[0-9a-f]{64}$/);
  expect(a).toBe(b);
  expect(await hashIp("1.2.3.5", "salt")).not.toBe(a);
});

test("geoFromRequest reads cf, defaults to null", () => {
  expect(geoFromRequest({ cf: { country: "IN", city: "Pune", asOrganization: "Jio" } }))
    .toEqual({ country: "IN", city: "Pune", asn_org: "Jio" });
  expect(geoFromRequest({})).toEqual({ country: null, city: null, asn_org: null });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/enrich.test.js`
Expected: FAIL ("Cannot find module .../enrich.js").

- [ ] **Step 3: Write `functions/_lib/enrich.js`**

```js
export async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(String(ip) + "|" + String(salt));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function geoFromRequest(request) {
  const cf = (request && request.cf) || {};
  return {
    country: cf.country || null,
    city: cf.city || null,
    asn_org: cf.asOrganization || null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/enrich.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/enrich.js test/enrich.test.js
git commit -m "feat: enrichment helpers (hashIp, geoFromRequest)"
```

---

### Task 4: Event-batch validation (`validate.js`)

**Files:**
- Create: `functions/_lib/validate.js`, `test/validate.test.js`

**Interfaces:**
- Produces: `validateBatch(body) -> { ok:true, events:[{event,props,path,referrer,utm}] } | { ok:false, error:string }`. Rejects: missing/blank `visitor_id`, non-array events, > 50 events, any event name outside the allowed set.

- [ ] **Step 1: Write the failing test `test/validate.test.js`**

```js
import { expect, test } from "vitest";
import { validateBatch } from "../functions/_lib/validate.js";

test("accepts a valid batch", () => {
  const r = validateBatch({ visitor_id: "v1", events: [{ event: "page_view", props: {} }] });
  expect(r.ok).toBe(true);
  expect(r.events).toHaveLength(1);
});

test("rejects missing visitor_id", () => {
  expect(validateBatch({ events: [] }).ok).toBe(false);
});

test("rejects unknown event name", () => {
  expect(validateBatch({ visitor_id: "v1", events: [{ event: "evil" }] }).ok).toBe(false);
});

test("rejects more than 50 events", () => {
  const events = Array.from({ length: 51 }, () => ({ event: "page_view" }));
  expect(validateBatch({ visitor_id: "v1", events }).ok).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/validate.test.js`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Write `functions/_lib/validate.js`**

```js
const ALLOWED = new Set([
  "page_view", "cta_click", "nav_click", "scroll_depth", "section_view",
  "faq_open", "demo_view", "demo_step", "time_on_page", "slot_booked",
  "form_start", "form_submit", "mailto_click", "return_visit",
]);

export function validateBatch(body) {
  if (!body || typeof body.visitor_id !== "string" || !body.visitor_id.trim())
    return { ok: false, error: "missing visitor_id" };
  if (!Array.isArray(body.events)) return { ok: false, error: "events must be an array" };
  if (body.events.length > 50) return { ok: false, error: "too many events" };
  const events = [];
  for (const e of body.events) {
    if (!e || !ALLOWED.has(e.event)) return { ok: false, error: "bad event: " + (e && e.event) };
    events.push({
      event: e.event,
      props: e.props && typeof e.props === "object" ? e.props : {},
      path: typeof e.path === "string" ? e.path : null,
      referrer: typeof e.referrer === "string" ? e.referrer : null,
      utm: e.utm && typeof e.utm === "object" ? e.utm : {},
    });
  }
  return { ok: true, events };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/validate.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/validate.js test/validate.test.js
git commit -m "feat: event batch validation"
```

---

### Task 5: DB write/read for events (`db.js` part 1) + CORS helper

**Files:**
- Create: `functions/_lib/db.js`, `functions/_lib/cors.js`
- Modify: `test/db.test.js` (add insert/read tests)

**Interfaces:**
- Produces:
  - `insertEvents(DB, rows) -> Promise<void>` where each row has keys `{ts,visitor_id,session_id,event,props,path,referrer,utm_source,utm_medium,utm_campaign,country,city,asn_org,ip_hash,ua}` (props already a JSON string).
  - `eventsForVisitor(DB, visitor_id) -> Promise<Array<{event,props,ts}>>` (props as stored JSON string).
  - `corsHeaders(request, env) -> object`.

- [ ] **Step 1: Add failing tests to `test/db.test.js`** (append below the existing schema test)

```js
import { insertEvents, eventsForVisitor } from "../functions/_lib/db.js";

test("insertEvents writes rows and eventsForVisitor reads them back", async () => {
  await insertEvents(env.DB, [{
    ts: 1000, visitor_id: "vX", session_id: "s1", event: "page_view",
    props: JSON.stringify({ a: 1 }), path: "/", referrer: "direct",
    utm_source: null, utm_medium: null, utm_campaign: null,
    country: "IN", city: "Pune", asn_org: "Jio", ip_hash: "abc", ua: "UA",
  }]);
  const rows = await eventsForVisitor(env.DB, "vX");
  expect(rows).toHaveLength(1);
  expect(rows[0].event).toBe("page_view");
  expect(JSON.parse(rows[0].props)).toEqual({ a: 1 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/db.test.js`
Expected: FAIL ("Cannot find module .../db.js").

- [ ] **Step 3: Write `functions/_lib/cors.js`**

```js
export function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env && env.SITE_ORIGIN) || "";
  const allow = origin && (origin === allowed) ? origin : allowed;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, GET, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
```

- [ ] **Step 4: Write `functions/_lib/db.js`** (events functions; later tasks append more)

```js
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
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run test/db.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/_lib/db.js functions/_lib/cors.js test/db.test.js
git commit -m "feat: events DB writes/reads + CORS helper"
```

---

### Task 6: `POST /api/track` endpoint

**Files:**
- Create: `functions/api/track.js`, `test/api-track.test.js`

**Interfaces:**
- Consumes: `validateBatch`, `geoFromRequest`, `hashIp`, `insertEvents`, `corsHeaders`.
- Produces: Pages Function exporting `onRequestPost({request, env})` (→ 204 on success, 400/413 on error) and `onRequestOptions`. Reads `CF-Connecting-IP` header + `request.cf` for enrichment; uses `env.IP_SALT`.

- [ ] **Step 1: Write the failing test `test/api-track.test.js`**

```js
import { env } from "cloudflare:test";
import { beforeAll, expect, test } from "vitest";
import { applySchema } from "./helpers/applySchema.js";
import { onRequestPost } from "../functions/api/track.js";
import { eventsForVisitor } from "../functions/_lib/db.js";

beforeAll(async () => { await applySchema(env.DB); });

function post(body) {
  return new Request("http://localhost/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "9.9.9.9" },
    body: JSON.stringify(body),
  });
}

test("stores a valid batch and returns 204", async () => {
  const res = await onRequestPost({ request: post({ visitor_id: "vt1", session_id: "s", events: [{ event: "cta_click", props: { location: "hero" } }] }), env });
  expect(res.status).toBe(204);
  const rows = await eventsForVisitor(env.DB, "vt1");
  expect(rows).toHaveLength(1);
  expect(rows[0].event).toBe("cta_click");
});

test("rejects a bad batch with 400", async () => {
  const res = await onRequestPost({ request: post({ events: [] }), env });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/api-track.test.js`
Expected: FAIL ("Cannot find module .../track.js").

- [ ] **Step 3: Write `functions/api/track.js`**

```js
import { validateBatch } from "../_lib/validate.js";
import { geoFromRequest, hashIp } from "../_lib/enrich.js";
import { insertEvents } from "../_lib/db.js";
import { corsHeaders } from "../_lib/cors.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const text = await request.text();
  if (text.length > 16384) return new Response("too large", { status: 413, headers: cors });
  let body;
  try { body = JSON.parse(text); } catch { return new Response("bad json", { status: 400, headers: cors }); }
  const v = validateBatch(body);
  if (!v.ok) return new Response(v.error, { status: 400, headers: cors });

  const geo = geoFromRequest(request);
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const ip_hash = await hashIp(ip, env.IP_SALT || "doot");
  const ua = request.headers.get("User-Agent") || null;
  const now = Date.now();

  const rows = v.events.map((e) => ({
    ts: now, visitor_id: body.visitor_id, session_id: body.session_id || null,
    event: e.event, props: JSON.stringify(e.props || {}),
    path: e.path, referrer: e.referrer,
    utm_source: e.utm.utm_source || null, utm_medium: e.utm.utm_medium || null, utm_campaign: e.utm.utm_campaign || null,
    country: geo.country, city: geo.city, asn_org: geo.asn_org, ip_hash, ua,
  }));
  await insertEvents(env.DB, rows);
  return new Response(null, { status: 204, headers: cors });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/api-track.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/api/track.js test/api-track.test.js
git commit -m "feat: POST /api/track endpoint"
```

---

### Task 7: Client analytics module + wire into `doot.html`

**Files:**
- Create: `assets/doot-analytics.js`, `test/client-analytics.test.js`
- Modify: `doot.html` (remove the old console-only `track()` body; load the module; keep `data-track` wiring)

**Interfaces:**
- Consumes: `POST /api/track` contract.
- Produces (testable pure helpers, exported when `module.exports`/ESM available): `getVisitorId(store) -> string`, `makeQueue() -> { push(e), drain() }`. The module also self-initializes on the page (`window.dootTrack`).

- [ ] **Step 1: Write the failing test `test/client-analytics.test.js`**

```js
import { expect, test } from "vitest";
import { getVisitorId, makeQueue } from "../assets/doot-analytics.js";

test("getVisitorId persists a stable id in the store", () => {
  const store = new Map();
  const shim = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const a = getVisitorId(shim);
  const b = getVisitorId(shim);
  expect(a).toBe(b);
  expect(a).toMatch(/[0-9a-f-]{12,}/);
});

test("makeQueue pushes and drains", () => {
  const q = makeQueue();
  q.push({ event: "page_view" });
  q.push({ event: "cta_click" });
  expect(q.drain()).toHaveLength(2);
  expect(q.drain()).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/client-analytics.test.js`
Expected: FAIL ("Cannot find module .../doot-analytics.js").

- [ ] **Step 3: Write `assets/doot-analytics.js`**

```js
// Pure, testable helpers + browser self-init. Safe to import in Node/vitest.
export function getVisitorId(store) {
  let id = store.getItem("doot_vid");
  if (!id) {
    id = (globalThis.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "v-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e9).toString(36);
    store.setItem("doot_vid", id);
  }
  return id;
}

export function makeQueue() {
  let buf = [];
  return { push: (e) => buf.push(e), drain: () => { const out = buf; buf = []; return out; } };
}

// ---- browser self-init (skipped under test where there is no document) ----
if (typeof document !== "undefined") {
  const API = "/api/track";
  const store = window.localStorage;
  const visitor_id = getVisitorId(store);
  let session_id = sessionStorage.getItem("doot_sid");
  if (!session_id) { session_id = Math.random().toString(36).slice(2); sessionStorage.setItem("doot_sid", session_id); }

  const qs = new URLSearchParams(location.search), utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => { if (qs.get(k)) utm[k] = qs.get(k); });

  const queue = makeQueue();
  function flush() {
    const events = queue.drain();
    if (!events.length) return;
    const payload = JSON.stringify({ visitor_id, session_id, events });
    if (navigator.sendBeacon) navigator.sendBeacon(API, new Blob([payload], { type: "application/json" }));
    else fetch(API, { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
  }
  window.dootTrack = function (event, props) {
    queue.push({ event, props: props || {}, path: location.pathname, referrer: document.referrer || "direct", utm });
    if (event === "form_submit" || event === "cta_click" || event === "slot_booked") flush();
  };
  setInterval(flush, 5000);
  window.addEventListener("pagehide", flush);

  // return-visit detection
  const last = store.getItem("doot_last");
  if (last) window.dootTrack("return_visit", { since: last });
  store.setItem("doot_last", String(Date.now()));

  window.addEventListener("load", () => window.dootTrack("page_view", { referrer: document.referrer || "direct", ...utm }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/client-analytics.test.js`
Expected: PASS (the `if (typeof document...)` block is skipped in vitest).

- [ ] **Step 5: Modify `doot.html` — replace the inline analytics IIFE**

In `doot.html`, replace the entire first `<script>` block (the one beginning `/* ---------------- Doot analytics: tracks every meaningful interaction ----------------`, lines ~531–593) with a module include plus the DOM listeners that translate page events into `window.dootTrack(...)` calls:

```html
<script type="module" src="/assets/doot-analytics.js"></script>
<script>
/* DOM → dootTrack bridges (kept here so they live with the markup) */
(function () {
  function t(){ return window.dootTrack || function(){}; }
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-track]"); if (!el) return;
    var name = el.getAttribute("data-track");
    t()(name, { location: el.getAttribute("data-loc") || "", label: (el.textContent || "").trim().slice(0, 60) });
    if (el.getAttribute("href") && el.getAttribute("href").indexOf("mailto:") === 0) t()("mailto_click", { location: el.getAttribute("data-loc") || "" });
  });
  var marks = [25, 50, 75, 100], hit = {};
  window.addEventListener("scroll", function () {
    var sc = (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100;
    marks.forEach(function (m) { if (sc >= m && !hit[m]) { hit[m] = 1; t()("scroll_depth", { percent: m }); } });
  }, { passive: true });
  var so = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { t()("section_view", { section: en.target.id }); so.unobserve(en.target); } });
  }, { threshold: .4 });
  document.querySelectorAll("section[id]").forEach(function (s) { so.observe(s); });
  document.querySelectorAll("#faq details").forEach(function (d) {
    d.addEventListener("toggle", function () { if (d.open) t()("faq_open", { q: (d.querySelector("summary").textContent || "").trim().slice(0, 50) }); });
  });
  var start = Date.now();
  window.addEventListener("pagehide", function () { t()("time_on_page", { seconds: Math.round((Date.now() - start) / 1000) }); });
  window.addEventListener("message", function (e) { if (e.data && e.data.event === "calendly.event_scheduled") t()("slot_booked", { source: "calendly" }); });
})();
</script>
```

Also update the demo walkthrough script (`doot.html` line ~648 and ~656) — it already calls `window.dootTrack&&window.dootTrack('demo_step',...)` and `'demo_view'`; leave those as-is (they now route through the new module).

- [ ] **Step 6: Manual verification (real browser, local)**

Run: `npm run dev` (starts `wrangler pages dev` with the D1 binding on http://localhost:8788)
In the browser: open the page, open DevTools → Network, filter `track`. Click a CTA, scroll, open a FAQ. Confirm a `POST /api/track` with status 204 fires (on the 5s interval, on CTA click, or on tab close).
Then confirm rows landed:
Run: `npx wrangler d1 execute doot-analytics --local --command "SELECT event, count(*) FROM events GROUP BY event"`
Expected: rows for `page_view`, `cta_click`, `scroll_depth`, etc.

- [ ] **Step 7: Commit**

```bash
git add assets/doot-analytics.js test/client-analytics.test.js doot.html
git commit -m "feat: client analytics module beaconing to /api/track; wire doot.html"
```

---

## Phase 2 — Lead form

### Task 8: Company-from-email (`domain.js`)

**Files:**
- Create: `functions/_lib/domain.js`, `test/domain.test.js`

**Interfaces:**
- Produces: `companyFromEmail(email) -> { domain, company }`. Free-provider domains → `company: "personal"`. Invalid email → `{ domain: null, company: null }`. Otherwise `company` is the domain's root word, capitalized (e.g. `priya@acme.io` → `{ domain: "acme.io", company: "Acme" }`).

- [ ] **Step 1: Write the failing test `test/domain.test.js`**

```js
import { expect, test } from "vitest";
import { companyFromEmail } from "../functions/_lib/domain.js";

test("derives company from a work domain", () => {
  expect(companyFromEmail("priya@acme.io")).toEqual({ domain: "acme.io", company: "Acme" });
});
test("marks free providers as personal", () => {
  expect(companyFromEmail("someone@gmail.com")).toEqual({ domain: "gmail.com", company: "personal" });
});
test("handles invalid input", () => {
  expect(companyFromEmail("not-an-email")).toEqual({ domain: null, company: null });
  expect(companyFromEmail("")).toEqual({ domain: null, company: null });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/domain.test.js`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Write `functions/_lib/domain.js`**

```js
const FREE = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
  "aol.com", "proton.me", "protonmail.com", "live.com", "msn.com",
]);

export function companyFromEmail(email) {
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { domain: null, company: null };
  const domain = email.split("@")[1].toLowerCase();
  if (FREE.has(domain)) return { domain, company: "personal" };
  const root = domain.split(".")[0];
  return { domain, company: root.charAt(0).toUpperCase() + root.slice(1) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/domain.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/domain.js test/domain.test.js
git commit -m "feat: company-from-email derivation"
```

---

### Task 9: Intent scoring (`intent.js`)

**Files:**
- Create: `functions/_lib/intent.js`, `test/intent.test.js`

**Interfaces:**
- Produces: `intentScore(events) -> { score:number, bucket:"cold"|"warm"|"hot" }` where `events` is `[{event, props}]`. Weights per Global Constraints.

- [ ] **Step 1: Write the failing test `test/intent.test.js`**

```js
import { expect, test } from "vitest";
import { intentScore } from "../functions/_lib/intent.js";

test("cold by default", () => {
  expect(intentScore([{ event: "page_view", props: {} }])).toEqual({ score: 0, bucket: "cold" });
});
test("pricing FAQ + cta = warm", () => {
  const r = intentScore([
    { event: "faq_open", props: { q: "What does it cost?" } }, // +30
    { event: "cta_click", props: {} },                          // +20
  ]);
  expect(r.score).toBe(50);
  expect(r.bucket).toBe("warm");
});
test("form submit is always hot", () => {
  expect(intentScore([{ event: "form_submit", props: {} }]).bucket).toBe("hot");
});
test("pricing FAQ does not double-count with generic FAQ", () => {
  const r = intentScore([
    { event: "faq_open", props: { q: "price?" } },
    { event: "faq_open", props: { q: "switch tools?" } },
  ]);
  expect(r.score).toBe(30);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/intent.test.js`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Write `functions/_lib/intent.js`**

```js
export function intentScore(events) {
  let pricingFaq = false, anyFaq = false, maxDemo = -1, maxScroll = 0, maxTime = 0;
  let returned = false, cta = false, submitted = false;
  for (const ev of events || []) {
    const p = ev.props || {};
    switch (ev.event) {
      case "faq_open":
        anyFaq = true;
        if (/(price|cost)/i.test(p.q || "")) pricingFaq = true;
        break;
      case "demo_step": maxDemo = Math.max(maxDemo, Number(p.step) || 0); break;
      case "scroll_depth": maxScroll = Math.max(maxScroll, Number(p.percent) || 0); break;
      case "time_on_page": maxTime = Math.max(maxTime, Number(p.seconds) || 0); break;
      case "return_visit": returned = true; break;
      case "cta_click": cta = true; break;
      case "form_submit": submitted = true; break;
    }
  }
  let s = 0;
  if (pricingFaq) s += 30; else if (anyFaq) s += 10;
  if (maxDemo >= 2) s += 15;
  if (maxScroll >= 100) s += 15;
  if (maxTime > 120) s += 20;
  if (returned) s += 25;
  if (cta) s += 20;
  if (submitted) s += 100;
  const bucket = s >= 71 ? "hot" : s >= 31 ? "warm" : "cold";
  return { score: s, bucket };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/intent.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/intent.js test/intent.test.js
git commit -m "feat: visitor intent scoring"
```

---

### Task 10: Lead insert (`db.js` part 2)

**Files:**
- Modify: `functions/_lib/db.js` (add `insertLead`); `test/db.test.js` (add a lead test)

**Interfaces:**
- Produces: `insertLead(DB, lead) -> Promise<number>` (returns new lead id). `lead` keys: `{ts,visitor_id,name,email,company,message,status,intent_score,country,city,asn_org}`.

- [ ] **Step 1: Add failing test to `test/db.test.js`**

```js
import { insertLead } from "../functions/_lib/db.js";

test("insertLead returns an id and stores the row", async () => {
  const id = await insertLead(env.DB, {
    ts: 2000, visitor_id: "vL", name: "Priya", email: "priya@acme.io", company: "Acme",
    message: "interested", status: "new", intent_score: 50, country: "IN", city: "Pune", asn_org: "Jio",
  });
  expect(typeof id).toBe("number");
  const row = await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(id).first();
  expect(row.name).toBe("Priya");
  expect(row.status).toBe("new");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/db.test.js`
Expected: FAIL (`insertLead is not a function`).

- [ ] **Step 3: Append `insertLead` to `functions/_lib/db.js`**

```js
const LEAD_COLS = ["ts","visitor_id","name","email","company","message","status","intent_score","country","city","asn_org"];

export async function insertLead(DB, lead) {
  const sql = `INSERT INTO leads (${LEAD_COLS.join(",")}) VALUES (${LEAD_COLS.map(() => "?").join(",")})`;
  const res = await DB.prepare(sql).bind(...LEAD_COLS.map((c) => lead[c] ?? null)).run();
  return res.meta.last_row_id;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/db.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/db.js test/db.test.js
git commit -m "feat: insertLead DB write"
```

---

### Task 11: `POST /api/lead` endpoint

**Files:**
- Create: `functions/api/lead.js`, `test/api-lead.test.js`

**Interfaces:**
- Consumes: `companyFromEmail`, `geoFromRequest`, `insertEvents`, `eventsForVisitor`, `insertLead`, `intentScore`, `corsHeaders`.
- Produces: `onRequestPost({request,env})` → `{ok:true, id}` (200) or 400. Writes a `form_submit` event, then computes intent from the visitor's events, then inserts the lead.

- [ ] **Step 1: Write the failing test `test/api-lead.test.js`**

```js
import { env } from "cloudflare:test";
import { beforeAll, expect, test } from "vitest";
import { applySchema } from "./helpers/applySchema.js";
import { onRequestPost } from "../functions/api/lead.js";

beforeAll(async () => { await applySchema(env.DB); });

function post(body) {
  return new Request("http://localhost/api/lead", {
    method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": "8.8.8.8" },
    body: JSON.stringify(body),
  });
}

test("creates a lead with derived company and intent score, plus a form_submit event", async () => {
  const res = await onRequestPost({ request: post({ visitor_id: "vc1", name: "Priya", email: "priya@acme.io", message: "hi" }), env });
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  const lead = await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(json.id).first();
  expect(lead.company).toBe("Acme");
  expect(lead.intent_score).toBeGreaterThanOrEqual(100); // form_submit alone = 100
  const ev = await env.DB.prepare("SELECT count(*) c FROM events WHERE visitor_id='vc1' AND event='form_submit'").first();
  expect(ev.c).toBe(1);
});

test("rejects missing name/email", async () => {
  const res = await onRequestPost({ request: post({ visitor_id: "x" }), env });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/api-lead.test.js`
Expected: FAIL ("Cannot find module .../lead.js").

- [ ] **Step 3: Write `functions/api/lead.js`**

```js
import { companyFromEmail } from "../_lib/domain.js";
import { geoFromRequest } from "../_lib/enrich.js";
import { insertEvents, eventsForVisitor, insertLead } from "../_lib/db.js";
import { intentScore } from "../_lib/intent.js";
import { corsHeaders } from "../_lib/cors.js";

export async function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

export async function onRequestPost({ request, env }) {
  const cors = corsHeaders(request, env);
  const body = await request.json().catch(() => null);
  if (!body || !body.name || !body.email)
    return new Response("name and email required", { status: 400, headers: cors });

  const { company } = companyFromEmail(body.email);
  const geo = geoFromRequest(request);
  const now = Date.now();
  const visitor_id = body.visitor_id || null;

  if (visitor_id) {
    await insertEvents(env.DB, [{
      ts: now, visitor_id, session_id: body.session_id || null, event: "form_submit",
      props: JSON.stringify({}), path: body.path || null, referrer: null,
      utm_source: null, utm_medium: null, utm_campaign: null,
      country: geo.country, city: geo.city, asn_org: geo.asn_org, ip_hash: null, ua: null,
    }]);
  }

  const evs = visitor_id ? await eventsForVisitor(env.DB, visitor_id) : [{ event: "form_submit", props: {} }];
  const { score } = intentScore(evs.map((e) => ({ event: e.event, props: JSON.parse(e.props || "{}") })));

  const id = await insertLead(env.DB, {
    ts: now, visitor_id, name: body.name, email: body.email, company,
    message: body.message || null, status: "new", intent_score: score,
    country: geo.country, city: geo.city, asn_org: geo.asn_org,
  });
  return new Response(JSON.stringify({ ok: true, id }), {
    status: 200, headers: { "Content-Type": "application/json", ...cors },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/api-lead.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/api/lead.js test/api-lead.test.js
git commit -m "feat: POST /api/lead endpoint with company + intent"
```

---

### Task 12: Lead form in `doot.html`

**Files:**
- Modify: `doot.html` (add a form to the final CTA section; keep the mailto link as fallback; submit via fetch)

**Interfaces:**
- Consumes: `POST /api/lead`; `window.dootTrack` for `form_start` / `form_submit`.

- [ ] **Step 1: Add the form markup** inside the `.final` section in `doot.html` (after the mailto button, before the closing `</div>` of `.wrap`)

```html
<form id="lead-form" class="lead-form rise d2" novalidate
      style="margin:26px auto 0;max-width:440px;display:grid;gap:10px;text-align:left">
  <input name="name" required placeholder="Your name"
         style="padding:.8rem 1rem;border-radius:11px;border:1px solid var(--line-2);font:inherit">
  <input name="email" type="email" required placeholder="Work email"
         style="padding:.8rem 1rem;border-radius:11px;border:1px solid var(--line-2);font:inherit">
  <textarea name="message" rows="2" placeholder="What do you sell / how do you do outbound today? (optional)"
         style="padding:.8rem 1rem;border-radius:11px;border:1px solid var(--line-2);font:inherit;resize:vertical"></textarea>
  <button type="submit" class="btn btn-primary" style="justify-content:center">Book a 10-min look</button>
  <p class="risk" id="lead-msg" style="margin-top:4px">We track on-page interactions to improve Doot. No deck, no obligation.</p>
</form>
```

- [ ] **Step 2: Add the submit handler** (append inside the existing DOM-bridge `<script>` from Task 7, before its closing `})();`)

```js
var form = document.getElementById("lead-form");
if (form) {
  var started = false;
  form.addEventListener("focusin", function () { if (!started) { started = true; t()("form_start", {}); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var msg = document.getElementById("lead-msg");
    var vid = window.localStorage.getItem("doot_vid");
    var sid = window.sessionStorage.getItem("doot_sid");
    fetch("/api/lead", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: vid, session_id: sid, path: location.pathname,
        name: fd.get("name"), email: fd.get("email"), message: fd.get("message") }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) { t()("form_submit", {}); msg.textContent = "Got it — I'll reply within a day."; form.reset(); }
      else { msg.textContent = "Something went wrong — email asatianant2678@gmail.com directly."; }
    }).catch(function () { msg.textContent = "Network issue — email asatianant2678@gmail.com directly."; });
  });
}
```

- [ ] **Step 3: Manual verification (local)**

Run: `npm run dev`
Fill the form on the page and submit. Confirm the success message appears, then:
Run: `npx wrangler d1 execute doot-analytics --local --command "SELECT name, email, company, intent_score, status FROM leads ORDER BY id DESC LIMIT 3"`
Expected: your submission with a derived company and a non-null `intent_score`.

- [ ] **Step 4: Commit**

```bash
git add doot.html
git commit -m "feat: on-page lead form posting to /api/lead"
```

---

## Phase 3 — Admin panel

### Task 13: Admin queries (`db.js` part 3)

**Files:**
- Modify: `functions/_lib/db.js` (add `overview`, `listLeads`, `leadById`, `updateLead`, `listVisitors`, `listEvents`); `test/db.test.js` (add tests)

**Interfaces:**
- Produces:
  - `overview(DB, sinceTs) -> { sessions, visitors, conversions, by_event:{[event]:count}, top_countries:[{country,n}] }`
  - `listLeads(DB) -> Array<lead row>`
  - `leadById(DB, id) -> { lead, timeline:[{event,props,ts}] }`
  - `updateLead(DB, id, {status?, company?}) -> Promise<void>`
  - `listVisitors(DB, sinceTs) -> Array<{visitor_id, events, last_ts, country, city, asn_org}>`
  - `listEvents(DB, {event, visitor_id, sinceTs, limit}) -> Array<event row>`

- [ ] **Step 1: Add failing tests to `test/db.test.js`**

```js
import { overview, listLeads, leadById, updateLead, listVisitors, listEvents } from "../functions/_lib/db.js";

test("admin queries aggregate correctly", async () => {
  await insertEvents(env.DB, [
    { ts: 5000, visitor_id: "va", session_id: "sa", event: "page_view", props: "{}", path: "/", referrer: "direct", utm_source: null, utm_medium: null, utm_campaign: null, country: "IN", city: "Pune", asn_org: "Jio", ip_hash: "h", ua: "u" },
    { ts: 5001, visitor_id: "va", session_id: "sa", event: "cta_click", props: "{}", path: "/", referrer: "direct", utm_source: null, utm_medium: null, utm_campaign: null, country: "IN", city: "Pune", asn_org: "Jio", ip_hash: "h", ua: "u" },
  ]);
  const ov = await overview(env.DB, 0);
  expect(ov.by_event.cta_click).toBeGreaterThanOrEqual(1);
  expect(ov.visitors).toBeGreaterThanOrEqual(1);

  const id = await insertLead(env.DB, { ts: 5002, visitor_id: "va", name: "A", email: "a@acme.io", company: "Acme", message: null, status: "new", intent_score: 20, country: "IN", city: "Pune", asn_org: "Jio" });
  expect((await listLeads(env.DB)).length).toBeGreaterThanOrEqual(1);
  const detail = await leadById(env.DB, id);
  expect(detail.lead.name).toBe("A");
  expect(detail.timeline.length).toBeGreaterThanOrEqual(2);
  await updateLead(env.DB, id, { status: "replied" });
  expect((await leadById(env.DB, id)).lead.status).toBe("replied");

  expect((await listVisitors(env.DB, 0)).some((v) => v.visitor_id === "va")).toBe(true);
  expect((await listEvents(env.DB, { event: "cta_click", limit: 10 })).length).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run test/db.test.js`
Expected: FAIL (`overview is not a function`).

- [ ] **Step 3: Append the query functions to `functions/_lib/db.js`**

```js
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run test/db.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/_lib/db.js test/db.test.js
git commit -m "feat: admin DB queries (overview, leads, visitors, events)"
```

---

### Task 14: Admin API functions + per-visitor intent

**Files:**
- Create: `functions/admin/api/overview.js`, `functions/admin/api/leads.js`, `functions/admin/api/visitors.js`, `functions/admin/api/events.js`, `functions/admin/api/lead/[id].js`, `test/admin-api.test.js`

**Interfaces:**
- Consumes: `db.js` query functions, `intentScore`.
- Produces:
  - `GET /admin/api/overview?range=today|7d|30d` → overview JSON.
  - `GET /admin/api/leads` → `{leads:[...]}`.
  - `GET /admin/api/visitors?range=...` → `{visitors:[{...,intent}]}` (intent computed per visitor).
  - `GET /admin/api/events?event=&visitor_id=&range=` → `{events:[...]}`.
  - `GET /admin/api/lead/:id` → `{lead, timeline}`; `PATCH` body `{status?,company?}` → `{ok:true}`.
- Shared `rangeToSince(range) -> number` helper (inline in each handler or a tiny `_lib` util).

- [ ] **Step 1: Add a range helper to `functions/_lib/db.js`**

```js
export function rangeToSince(range, now = Date.now()) {
  const day = 86400000;
  if (range === "today") return now - day;
  if (range === "30d") return now - 30 * day;
  return now - 7 * day; // default 7d
}
```

- [ ] **Step 2: Write the failing test `test/admin-api.test.js`**

```js
import { env } from "cloudflare:test";
import { beforeAll, expect, test } from "vitest";
import { applySchema } from "./helpers/applySchema.js";
import { insertEvents, insertLead } from "../functions/_lib/db.js";
import { onRequestGet as overviewGet } from "../functions/admin/api/overview.js";
import { onRequestGet as visitorsGet } from "../functions/admin/api/visitors.js";
import { onRequestGet as leadGet, onRequestPatch as leadPatch } from "../functions/admin/api/lead/[id].js";

beforeAll(async () => {
  await applySchema(env.DB);
  await insertEvents(env.DB, [
    { ts: Date.now(), visitor_id: "adm", session_id: "s", event: "cta_click", props: "{}", path: "/", referrer: "direct", utm_source: null, utm_medium: null, utm_campaign: null, country: "IN", city: "Pune", asn_org: "Jio", ip_hash: "h", ua: "u" },
    { ts: Date.now(), visitor_id: "adm", session_id: "s", event: "form_submit", props: "{}", path: "/", referrer: "direct", utm_source: null, utm_medium: null, utm_campaign: null, country: "IN", city: "Pune", asn_org: "Jio", ip_hash: "h", ua: "u" },
  ]);
});

test("overview returns counts", async () => {
  const res = await overviewGet({ request: new Request("http://x/admin/api/overview?range=7d"), env });
  const j = await res.json();
  expect(j.by_event.cta_click).toBeGreaterThanOrEqual(1);
});

test("visitors include an intent bucket", async () => {
  const res = await visitorsGet({ request: new Request("http://x/admin/api/visitors?range=7d"), env });
  const j = await res.json();
  const v = j.visitors.find((x) => x.visitor_id === "adm");
  expect(v.intent.bucket).toBe("hot"); // has form_submit
});

test("lead GET + PATCH status", async () => {
  const id = await insertLead(env.DB, { ts: Date.now(), visitor_id: "adm", name: "Z", email: "z@acme.io", company: "Acme", message: null, status: "new", intent_score: 120, country: "IN", city: "Pune", asn_org: "Jio" });
  const g = await leadGet({ request: new Request("http://x"), env, params: { id: String(id) } });
  expect((await g.json()).lead.name).toBe("Z");
  const p = await leadPatch({ request: new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "booked" }) }), env, params: { id: String(id) } });
  expect((await p.json()).ok).toBe(true);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run test/admin-api.test.js`
Expected: FAIL ("Cannot find module .../overview.js").

- [ ] **Step 4: Write `functions/admin/api/overview.js`**

```js
import { overview, rangeToSince } from "../../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const range = new URL(request.url).searchParams.get("range") || "7d";
  const data = await overview(env.DB, rangeToSince(range));
  return Response.json(data);
}
```

- [ ] **Step 5: Write `functions/admin/api/leads.js`**

```js
import { listLeads } from "../../_lib/db.js";

export async function onRequestGet({ env }) {
  return Response.json({ leads: await listLeads(env.DB) });
}
```

- [ ] **Step 6: Write `functions/admin/api/visitors.js`**

```js
import { listVisitors, eventsForVisitor, rangeToSince } from "../../_lib/db.js";
import { intentScore } from "../../_lib/intent.js";

export async function onRequestGet({ request, env }) {
  const range = new URL(request.url).searchParams.get("range") || "7d";
  const visitors = await listVisitors(env.DB, rangeToSince(range));
  const out = [];
  for (const v of visitors) {
    const evs = await eventsForVisitor(env.DB, v.visitor_id);
    const intent = intentScore(evs.map((e) => ({ event: e.event, props: JSON.parse(e.props || "{}") })));
    out.push({ ...v, intent });
  }
  return Response.json({ visitors: out });
}
```

- [ ] **Step 7: Write `functions/admin/api/events.js`**

```js
import { listEvents, rangeToSince } from "../../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const events = await listEvents(env.DB, {
    event: u.searchParams.get("event") || undefined,
    visitor_id: u.searchParams.get("visitor_id") || undefined,
    sinceTs: rangeToSince(u.searchParams.get("range") || "30d"),
    limit: 300,
  });
  return Response.json({ events });
}
```

- [ ] **Step 8: Write `functions/admin/api/lead/[id].js`**

```js
import { leadById, updateLead } from "../../../_lib/db.js";

export async function onRequestGet({ env, params }) {
  return Response.json(await leadById(env.DB, Number(params.id)));
}

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => ({}));
  await updateLead(env.DB, Number(params.id), { status: body.status, company: body.company });
  return Response.json({ ok: true });
}
```

- [ ] **Step 9: Run to verify it passes**

Run: `npx vitest run test/admin-api.test.js`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add functions/admin/api test/admin-api.test.js functions/_lib/db.js
git commit -m "feat: admin API endpoints (overview, leads, visitors, events, lead detail/patch)"
```

---

### Task 15: Admin dashboard UI

**Files:**
- Create: `admin/index.html`

**Interfaces:**
- Consumes: `/admin/api/*` endpoints.

- [ ] **Step 1: Write `admin/index.html`** (single self-contained page; navy/ember; vanilla JS tabs)

```html
<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Doot — Admin</title>
<style>
  :root{--ink:#0F1635;--ember:#EC7D1E;--paper:#F6F8FC;--line:#E3E8F3;--muted:#6E7699}
  *{box-sizing:border-box;margin:0;font-family:system-ui,sans-serif}
  body{background:var(--paper);color:var(--ink);padding:24px;max-width:1100px;margin:0 auto}
  h1{font-size:1.4rem;margin-bottom:4px}.sub{color:var(--muted);margin-bottom:18px;font-size:.9rem}
  .tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
  .tabs button{padding:.5rem .9rem;border:1px solid var(--line);background:#fff;border-radius:8px;cursor:pointer}
  .tabs button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
  select#range{margin-left:auto;padding:.4rem;border-radius:8px;border:1px solid var(--line)}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px}
  .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}
  .card .n{font-size:1.8rem;font-weight:700}.card .l{color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.05em}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:12px;overflow:hidden}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);font-size:.9rem}
  th{background:#fff;color:var(--muted);font-weight:600}
  .badge{padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:700}
  .hot{background:#FFE0CC;color:#B85F0C}.warm{background:#FFF3D6;color:#9a6b00}.cold{background:#EEF2FB;color:#6E7699}
  tr.click{cursor:pointer}tr.click:hover{background:var(--paper)}
  #drawer{position:fixed;top:0;right:0;height:100%;width:min(460px,92vw);background:#fff;border-left:1px solid var(--line);padding:20px;overflow:auto;transform:translateX(100%);transition:transform .25s;box-shadow:-20px 0 50px -30px rgba(0,0,0,.4)}
  #drawer.open{transform:none}#drawer .x{float:right;cursor:pointer;color:var(--muted)}
  .tl{list-style:none;margin-top:12px}.tl li{padding:6px 0;border-bottom:1px solid var(--line);font-size:.85rem}
  .hide{display:none}
</style></head><body>
<h1>Doot — Admin</h1><div class="sub">Custom analytics · leads · visitors</div>
<div class="tabs">
  <button data-tab="overview" class="on">Overview</button>
  <button data-tab="leads">Lead Inbox</button>
  <button data-tab="visitors">Visitors</button>
  <button data-tab="events">Raw events</button>
  <select id="range"><option value="today">Today</option><option value="7d" selected>7 days</option><option value="30d">30 days</option></select>
</div>
<div id="view"></div>
<div id="drawer"><span class="x" onclick="closeDrawer()">✕ close</span><div id="drawer-body"></div></div>

<script>
const $ = (s) => document.querySelector(s);
let tab = "overview";
const range = () => $("#range").value;
const fmt = (ts) => new Date(ts).toLocaleString();
const badge = (b) => `<span class="badge ${b}">${b}</span>`;

async function get(p){ const r = await fetch(p); return r.json(); }

async function render(){
  const view = $("#view");
  if (tab === "overview"){
    const d = await get(`/admin/api/overview?range=${range()}`);
    const ev = d.by_event || {};
    view.innerHTML = `<div class="cards">
      <div class="card"><div class="n">${d.visitors}</div><div class="l">Visitors</div></div>
      <div class="card"><div class="n">${d.sessions}</div><div class="l">Sessions</div></div>
      <div class="card"><div class="n">${d.conversions}</div><div class="l">Conversions</div></div>
      <div class="card"><div class="n">${d.visitors ? ((d.conversions/d.visitors)*100).toFixed(1) : 0}%</div><div class="l">Conv. rate</div></div>
    </div>
    <h3>Funnel</h3><table><tr><th>Step</th><th>Count</th></tr>
      ${["page_view","scroll_depth","demo_view","cta_click","form_submit"].map(k=>`<tr><td>${k}</td><td>${ev[k]||0}</td></tr>`).join("")}
    </table>
    <h3 style="margin-top:18px">Top countries</h3><table><tr><th>Country</th><th>Visitors</th></tr>
      ${(d.top_countries||[]).map(c=>`<tr><td>${c.country}</td><td>${c.n}</td></tr>`).join("")||"<tr><td colspan=2>—</td></tr>"}
    </table>`;
  } else if (tab === "leads"){
    const d = await get(`/admin/api/leads`);
    view.innerHTML = `<table><tr><th>Name</th><th>Company</th><th>Email</th><th>Intent</th><th>Status</th><th>When</th></tr>
      ${d.leads.map(l=>`<tr class="click" onclick="openLead(${l.id})">
        <td>${l.name||"—"}</td><td>${l.company||"—"}</td><td>${l.email||"—"}</td>
        <td>${l.intent_score??0}</td>
        <td><select onclick="event.stopPropagation()" onchange="setStatus(${l.id},this.value)">
          ${["new","replied","booked","closed"].map(s=>`<option ${s===l.status?"selected":""}>${s}</option>`).join("")}
        </select></td><td>${fmt(l.ts)}</td></tr>`).join("")||"<tr><td colspan=6>No leads yet</td></tr>"}
    </table>`;
  } else if (tab === "visitors"){
    const d = await get(`/admin/api/visitors?range=${range()}`);
    view.innerHTML = `<table><tr><th>Visitor</th><th>Identity</th><th>Events</th><th>Intent</th><th>Last seen</th></tr>
      ${d.visitors.map(v=>`<tr class="click" onclick="openVisitor('${v.visitor_id}')">
        <td>${v.visitor_id.slice(0,8)}</td>
        <td>${v.asn_org?`${v.asn_org}${v.city?", "+v.city:""}`:(v.country||"anonymous")}</td>
        <td>${v.events}</td><td>${badge(v.intent.bucket)} ${v.intent.score}</td><td>${fmt(v.last_ts)}</td></tr>`).join("")||"<tr><td colspan=5>No visitors yet</td></tr>"}
    </table>`;
  } else {
    const d = await get(`/admin/api/events?range=${range()}`);
    view.innerHTML = `<table><tr><th>When</th><th>Event</th><th>Visitor</th><th>Props</th></tr>
      ${d.events.map(e=>`<tr><td>${fmt(e.ts)}</td><td>${e.event}</td><td>${(e.visitor_id||"").slice(0,8)}</td><td><code>${(e.props||"").slice(0,80)}</code></td></tr>`).join("")||"<tr><td colspan=4>No events</td></tr>"}
    </table>`;
  }
}
async function openLead(id){
  const d = await get(`/admin/api/lead/${id}`); const l = d.lead;
  $("#drawer-body").innerHTML = `<h2>${l.name||"—"}</h2><div class="sub">${l.email||""} · ${l.company||""}</div>
    <p><b>Message:</b> ${l.message||"—"}</p><p><b>Intent:</b> ${l.intent_score}</p>
    <h3>Timeline</h3><ul class="tl">${d.timeline.map(t=>`<li>${fmt(t.ts)} — ${t.event} <code>${(t.props||"").slice(0,60)}</code></li>`).join("")}</ul>`;
  $("#drawer").classList.add("open");
}
async function openVisitor(vid){
  const d = await get(`/admin/api/events?visitor_id=${vid}&range=30d`);
  $("#drawer-body").innerHTML = `<h2>${vid.slice(0,8)}</h2><h3>Timeline</h3>
    <ul class="tl">${d.events.slice().reverse().map(t=>`<li>${fmt(t.ts)} — ${t.event} <code>${(t.props||"").slice(0,60)}</code></li>`).join("")}</ul>`;
  $("#drawer").classList.add("open");
}
function closeDrawer(){ $("#drawer").classList.remove("open"); }
async function setStatus(id, status){ await fetch(`/admin/api/lead/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({status}) }); }

document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click",()=>{
  tab = b.dataset.tab; document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("on",x===b)); render();
}));
$("#range").addEventListener("change", render);
render();
</script>
</body></html>
```

- [ ] **Step 2: Manual verification (local)**

Run: `npm run dev`
Open http://localhost:8788/admin/ . Confirm Overview shows counts, Lead Inbox lists your test lead, clicking a lead opens the drawer with its timeline, the status dropdown saves (re-load and confirm it stuck), Visitors shows intent badges, Raw events lists the stream.

- [ ] **Step 3: Commit**

```bash
git add admin/index.html
git commit -m "feat: admin dashboard UI (overview, leads, visitors, events)"
```

---

### Task 16: Cloudflare Access + production deploy

**Files:** none (configuration + ops); update `wrangler.toml` `[vars] SITE_ORIGIN` to the production URL.

**Interfaces:** Produces a deployed site with `/admin*` gated by Access and remote D1 migrated.

- [ ] **Step 1: Apply migrations to the remote D1**

Run: `npm run db:migrate:remote`
Expected: "Migrations applied" against the real `doot-analytics` DB.

- [ ] **Step 2: Set the production IP salt secret**

Run: `npx wrangler pages secret put IP_SALT`
Enter a long random string when prompted.

- [ ] **Step 3: Deploy**

Run: `npm run deploy`
Expected: a `*.pages.dev` URL. Update `[vars] SITE_ORIGIN` in `wrangler.toml` to that URL (or your custom domain) and `npm run deploy` again.

- [ ] **Step 4: Gate `/admin` with Cloudflare Access** (dashboard, no code)

In the Cloudflare dashboard → **Zero Trust → Access → Applications → Add a self-hosted application**:
- Application domain: your Pages domain, **path `/admin*`** (covers both the UI and `/admin/api/*`).
- Policy: **Allow**, include rule **Emails** → `asatianant2678@gmail.com` (add any teammates).
- Save. Visiting `/admin` now requires an email one-time code; everyone else is blocked at the edge.

- [ ] **Step 5: Production verification**

- Visit the site, click around, submit the form. Confirm `npx wrangler d1 execute doot-analytics --remote --command "SELECT count(*) FROM events"` grows.
- Visit `/admin` in an incognito window: confirm Access prompts for email; confirm a non-listed email is denied.
- After authenticating, confirm the dashboard shows real data.

- [ ] **Step 6: Commit**

```bash
git add wrangler.toml
git commit -m "chore: production SITE_ORIGIN + deploy config"
```

---

## Self-Review

**1. Spec coverage**
- §3 stack (CF Pages+Functions+D1+Access) → Tasks 1, 2, 16. ✓
- §4 data flow (visitor id, beacon, enrich, lead links timeline) → Tasks 7, 6, 11. ✓
- §5 identity cascade (Tier1 form domain / Tier2 geo+asn / Tier3 anon) → Task 8 (domain), Task 3 (geo), Tasks 13–15 (resolved display). ✓
- §6 data model → Task 2. ✓
- §7 events (incl. new form_start/form_submit/mailto_click/return_visit) → Task 4 (allowed set), Task 7 (return_visit, mailto_click, page_view, scroll, etc.), Task 12 (form_start/form_submit). ✓
- §8 intent score → Task 9; per-visitor application → Tasks 11, 14. ✓
- §9 API contract → Tasks 6, 11, 14. ✓
- §10 admin views (overview/funnel, lead inbox+status, visitors, raw) → Tasks 14, 15. ✓
- §11 privacy/security (hashed IP, no raw IP, body cap, rate-limit, Access) → Task 3 (hash), Task 6 (cap), Task 16 (Access). **Gap noted:** explicit per-IP rate-limit is described in the spec but not implemented as its own task; the 16 KB + ≤50-events caps mitigate abuse. Rate-limit deferred as a hardening follow-up (acceptable at current scale; called out here rather than silently dropped).
- §12 phases → Phases 0–3 map to Tasks 1–16. ✓

**2. Placeholder scan:** No "TBD"/"TODO"/"add error handling" placeholders; every code step shows real code. ✓

**3. Type consistency:** `insertEvents` row shape is identical across Tasks 5, 6, 11, 13 tests. `intentScore` returns `{score,bucket}` consistently (Tasks 9, 11, 14). `leadById` returns `{lead,timeline}` (Tasks 13, 14, 15). `companyFromEmail` returns `{domain,company}` (Tasks 8, 11). ✓

**Note for the implementer:** `?raw` SQL import (Task 2) relies on Vite, which vitest uses — works in test. The `[id].js` dynamic route and `onRequestPatch` are standard Pages Functions conventions.

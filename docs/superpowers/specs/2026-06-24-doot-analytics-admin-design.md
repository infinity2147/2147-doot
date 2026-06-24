# Doot — Custom Analytics + Lead Capture + Admin Panel (Design)

**Date:** 2026-06-24
**Owner:** Anant Asati
**Status:** Approved design, pre-implementation
**Scope:** Analytics collection, lead-capture form, admin panel. **Out of scope:** page redesign, copy, founder photo, domain email (separate spec).

---

## 1. Problem

`doot.html` is a single static landing page. Its `track()` function fires well-chosen events
(`page_view`, `cta_click`, `scroll_depth`, etc.) but has **nowhere to send them** — with no
provider ID pasted, every event goes to `console.debug`, so **nothing is stored for real
visitors**. The conversion event (`slot_booked`) only fires on a Calendly embed that doesn't
exist; the real CTA is a `mailto:` link, so conversions are unmeasurable and leads land in a
personal inbox with no capture.

We want our **own free, self-hosted analytics** that stores every meaningful interaction,
builds a per-visitor profile to score intent, captures leads directly, and exposes all of it
in a private admin panel.

## 2. Goals / Non-goals

**Goals**
- Persist every meaningful event for every real visitor (not console-only).
- Stitch all of one person's events/visits into a single timeline (first-party visitor ID).
- Resolve the best-available identity per visitor (cascade — see §5).
- Capture leads via an on-page form (not `mailto:`), making conversion measurable.
- A private admin panel: overview/funnel, lead inbox (with status), visitors, raw events.
- $0 at current scale; no credit card; scales to zero.

**Non-goals (this spec)**
- True IP→company reveal (paid data product) — deferred.
- Gmail reply sync — deferred.
- Page redesign / copy / founder photo / domain email — separate spec.
- ML/predictive scoring — we use a transparent weighted heuristic.

## 3. Stack & architecture

One **Cloudflare Pages** project (Functions = Workers under the hood) + **D1** (SQLite) +
**Cloudflare Access** on `/admin`. No separate server, no build step, scales to zero, free tier.

```
                    ┌──────────────────────── Cloudflare ────────────────────────┐
  Visitor  ───────► │  Pages: doot.html (static)                                  │
   browser          │     │ beacon events           form submit                   │
                    │     ▼                            ▼                           │
                    │  POST /api/track            POST /api/lead                   │
                    │        └──────────┐      ┌────────┘                          │
                    │                   ▼      ▼                                    │
                    │            ┌──────── D1 (SQLite) ────────┐                    │
                    │            │  events        leads        │                    │
                    │            └─────────────────────────────┘                    │
   You  ──────────► │  GET /admin/*   ── (Cloudflare Access) ── queries D1          │
 (email-gated)      └──────────────────────────────────────────────────────────────┘
```

## 4. Data flow

1. Page load → JS reads/creates `visitor_id` (localStorage UUID, persists across visits) and a
   per-load `session_id` (sessionStorage). Sets `return_visit` if a prior visit is recorded.
2. `track()` is upgraded into a façade: keeps console logging in dev and the optional
   gtag/posthog/clarity hooks, **and** pushes the event onto an in-memory queue.
3. `flush()` sends the queued batch via `navigator.sendBeacon('/api/track', json)` on a short
   interval and on `pagehide` (non-blocking, survives tab close).
4. The Function stamps each event server-side: `ts`, hashed IP, edge geo + network-org
   (`request.cf.country/city/asOrganization`), then inserts into `events`.
5. Form submit → `POST /api/lead` → derives company from the work-email domain → inserts a row
   into `leads` **and** a `form_submit` event, all keyed by `visitor_id` so the lead inherits
   the visitor's full event timeline.
6. `/admin/*` (behind Access) serves the dashboard HTML + JSON data endpoints that query D1.

## 5. Identity cascade

Every visitor always gets a stitched timeline (Tier 3 base). Display identity resolves to the
best available tier:

- **Tier 1 — KNOWN:** form submitted → name, work email, company (derived from email domain).
- **Tier 2 — PROBABLE:** no form, but edge-provided geo (country/city) + network-org (ASN).
  Free via `request.cf`; labelled "probable" and not over-trusted (often an ISP, not the
  company). True IP→company reveal is a deferred paid upgrade.
- **Tier 3 — ANONYMOUS:** only the visitor ID + behavior.

## 6. Data model (D1 / SQLite)

```sql
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,            -- server epoch ms
  visitor_id  TEXT    NOT NULL,
  session_id  TEXT,
  event       TEXT    NOT NULL,
  props       TEXT,                        -- JSON: {location,label,percent,section,q,step,seconds,...}
  path        TEXT,
  referrer    TEXT,
  utm_source  TEXT, utm_medium TEXT, utm_campaign TEXT,
  country     TEXT, city TEXT, asn_org TEXT,
  ip_hash     TEXT,                         -- sha256(ip + rotating salt); never raw IP
  ua          TEXT
);
CREATE INDEX idx_events_visitor ON events(visitor_id);
CREATE INDEX idx_events_ts      ON events(ts);
CREATE INDEX idx_events_event   ON events(event);

CREATE TABLE leads (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,
  visitor_id   TEXT,
  name         TEXT,
  email        TEXT,
  company      TEXT,                        -- derived from email domain, editable in admin
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'new', -- new | replied | booked | closed
  intent_score INTEGER,
  country      TEXT, city TEXT, asn_org TEXT
);
CREATE INDEX idx_leads_status ON leads(status);
```

No separate visitors/sessions table — journeys are computed with `GROUP BY visitor_id`. A
rollup table can be added later only if traffic justifies it.

## 7. Event taxonomy

Keep existing: `page_view`, `cta_click`, `nav_click`, `scroll_depth`, `section_view`,
`faq_open`, `demo_view`, `demo_step`, `time_on_page`, `slot_booked`.

Add: `form_start`, `form_submit` (**conversion**), `mailto_click` (measure the fallback link),
`return_visit`.

## 8. Intent score (transparent heuristic)

Per-visitor weighted sum (editable; computed in admin from the event list):

```
pricing FAQ open ........ +30
any FAQ open ............ +10
demo watched to step 3-4  +15
scroll 100% ............. +15
> 2 min on page ......... +20
return visit ............ +25
cta_click ............... +20
form_submit ............. +100
```
Buckets: `0–30 cold · 31–70 warm · 71+ HOT`.

## 9. API contract

- `POST /api/track` — body `{ visitor_id, session_id, events:[{event, ts_client, props, path,
  referrer, utm}] }`. Server enriches + inserts. Returns `204`. Body cap ~16 KB, ≤50 events/batch,
  light per-IP rate-limit. CORS restricted to the site origin.
- `POST /api/lead` — body `{ visitor_id, name, email, message }`. Derives company from email
  domain (free-provider domains → company = "personal"); inserts `leads` + a `form_submit`
  event. Returns `{ ok:true, id }`.
- `GET /admin/api/overview?range=today|7d|30d` — counts, conversion rate, top sources, top
  countries, funnel steps.
- `GET /admin/api/leads` — lead list. `GET /admin/api/lead/:id` — lead + full event timeline.
- `PATCH /admin/api/lead/:id` — update `status` / `company`.
- `GET /admin/api/visitors?range=...` — visitors with resolved identity + intent score.
- `GET /admin/api/events?event=&visitor_id=&range=` — filterable raw stream.
  All `/admin/*` routes behind Cloudflare Access.

## 10. Admin panel

Single self-contained page (navy/ember aesthetic), vanilla JS, no framework, no build:

1. **Overview** — `Today/7d/30d` toggle: sessions, unique visitors, conversions + rate, top
   sources (UTM/referrer), top countries, funnel `page_view → scroll 50% → demo_view →
   cta_click → form_submit`.
2. **Lead Inbox** (the "replies" surface) — table: name · company · email · intent badge ·
   status dropdown (`new/replied/booked/closed`, editable inline) · submitted-at. Row → drawer
   with full event timeline + their message. Status edits are how replies are tracked
   (no Gmail integration this phase).
3. **Visitors** — recent visitors with resolved identity (company → geo+network → anonymous id),
   event count, intent score, last seen. Surfaces hot anonymous visitors.
4. **Raw events** — filterable stream for verifying events fire.

## 11. Privacy & security

- First-party only; no third-party trackers required (gtag/posthog/clarity remain optional).
- Never store raw IP — `sha256(ip + rotating salt)` for unique counts; coarse geo + ASN only.
- PII (name/email) only when voluntarily submitted via the form. Admin behind Cloudflare Access.
- Short honest notice near the form ("we track on-page interactions to improve Doot").
- `/api/track` caps body size + light per-IP rate-limit to prevent abuse of the open endpoint.

## 12. Build phases (each independently shippable)

- **Phase 0 — Scaffold:** Pages project + D1 + schema migration + Access policy on `/admin`.
- **Phase 1 — Collection:** upgrade `track()` → batch + beacon → `/api/track` → D1 with edge
  enrichment. (Fixes "we store nothing.")
- **Phase 2 — Lead form:** inline form in `doot.html` (mailto kept as fallback) + `/api/lead` +
  `leads` table. (Fixes the biggest leak; makes conversion real.)
- **Phase 3 — Admin panel:** the four views above, behind Access.
- **Phase 4 — Later/optional:** true IP→company reveal, Gmail reply sync, HOT-lead email/Slack alert.

## 13. Open questions / future

- Hosting cutover: keep current static host or move serving to Cloudflare Pages (recommended so
  the page and API are same-origin — simplifies CORS).
- Exact intent weights will be tuned once real traffic arrives.

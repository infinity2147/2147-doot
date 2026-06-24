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

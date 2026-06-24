import { env } from "cloudflare:test";
import { beforeAll, expect, test } from "vitest";
import { applySchema } from "./helpers/applySchema.js";
import { insertEvents, eventsForVisitor, insertLead, overview, listLeads, leadById, updateLead, listVisitors, listEvents } from "../functions/_lib/db.js";

beforeAll(async () => { await applySchema(env.DB); });

test("schema creates events and leads tables", async () => {
  const { results } = await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all();
  const names = results.map((r) => r.name);
  expect(names).toContain("events");
  expect(names).toContain("leads");
});

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

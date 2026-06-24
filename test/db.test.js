import { env } from "cloudflare:test";
import { beforeAll, expect, test } from "vitest";
import { applySchema } from "./helpers/applySchema.js";
import { insertEvents, eventsForVisitor, insertLead } from "../functions/_lib/db.js";

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

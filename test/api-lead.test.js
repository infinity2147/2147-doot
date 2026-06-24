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

test("creates a lead without visitor_id using synthetic form_submit event", async () => {
  const res = await onRequestPost({ request: post({ name: "NoVid", email: "x@beta.io" }), env });
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  const lead = await env.DB.prepare("SELECT * FROM leads WHERE id = ?").bind(json.id).first();
  expect(lead.company).toBe("Beta");
  expect(lead.intent_score).toBeGreaterThanOrEqual(100);
});

test("rejects overly long fields with 400 and writes no lead", async () => {
  const longName = "a".repeat(201);
  const res = await onRequestPost({ request: post({ name: longName, email: "x@valid.io" }), env });
  expect(res.status).toBe(400);
  const lead = await env.DB.prepare("SELECT count(*) c FROM leads WHERE name = ?").bind(longName).first();
  expect(lead.c).toBe(0);
});

test("rejects message longer than 2000 chars with 400", async () => {
  const longMsg = "m".repeat(2001);
  const res = await onRequestPost({ request: post({ name: "Valid", email: "v@ok.io", message: longMsg }), env });
  expect(res.status).toBe(400);
});

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

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

test("drops unknown events while keeping valid ones (batch still succeeds)", () => {
  const r = validateBatch({ visitor_id: "v1", events: [{ event: "page_view" }, { event: "evil" }, { event: "cta_click" }] });
  expect(r.ok).toBe(true);
  expect(r.events).toHaveLength(2);
  expect(r.events.map((e) => e.event)).toEqual(["page_view", "cta_click"]);
});

test("accepts contact_click", () => {
  const r = validateBatch({ visitor_id: "v1", events: [{ event: "contact_click" }] });
  expect(r.ok).toBe(true);
  expect(r.events).toHaveLength(1);
});

test("rejects more than 50 events", () => {
  const events = Array.from({ length: 51 }, () => ({ event: "page_view" }));
  expect(validateBatch({ visitor_id: "v1", events }).ok).toBe(false);
});

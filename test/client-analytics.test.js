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

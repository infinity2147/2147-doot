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

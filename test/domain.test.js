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

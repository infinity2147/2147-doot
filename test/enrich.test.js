import { expect, test } from "vitest";
import { geoFromRequest, hashIp } from "../functions/_lib/enrich.js";

test("hashIp returns a 64-char hex sha256 and is deterministic", async () => {
  const a = await hashIp("1.2.3.4", "salt");
  const b = await hashIp("1.2.3.4", "salt");
  expect(a).toMatch(/^[0-9a-f]{64}$/);
  expect(a).toBe(b);
  expect(await hashIp("1.2.3.5", "salt")).not.toBe(a);
});

test("geoFromRequest reads cf, defaults to null", () => {
  expect(geoFromRequest({ cf: { country: "IN", city: "Pune", asOrganization: "Jio" } }))
    .toEqual({ country: "IN", city: "Pune", asn_org: "Jio" });
  expect(geoFromRequest({})).toEqual({ country: null, city: null, asn_org: null });
});

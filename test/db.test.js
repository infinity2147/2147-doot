import { env } from "cloudflare:test";
import { beforeAll, expect, test } from "vitest";
import { applySchema } from "./helpers/applySchema.js";

beforeAll(async () => { await applySchema(env.DB); });

test("schema creates events and leads tables", async () => {
  const { results } = await env.DB
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all();
  const names = results.map((r) => r.name);
  expect(names).toContain("events");
  expect(names).toContain("leads");
});

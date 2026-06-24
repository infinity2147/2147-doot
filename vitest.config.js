import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: "2026-06-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: { DB: "test-db" },
          bindings: { IP_SALT: "test-salt", SITE_ORIGIN: "http://localhost:8788" },
        },
      },
    },
  },
});

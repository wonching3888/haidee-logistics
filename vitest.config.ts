import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/inbound-crate-stock-account.test.ts",
      "lib/market-do-route-groups.test.ts",
      "lib/parse-year-month-params.test.ts",
      "lib/sadao-stock.test.ts",
      "lib/search-filters.test.ts",
      "lib/db-retry.test.ts",
      "lib/driver-voucher-status.test.ts",
      "lib/driver-voucher-audit.test.ts",
      "lib/trip-cost-engine/config.test.ts",
      "lib/trip-cost-engine/legacy-adapter.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

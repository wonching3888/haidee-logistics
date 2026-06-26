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
      "lib/trip-cost-engine/voucher-cost-resolver.test.ts",
      "lib/driver-expense/market-actuals-service.test.ts",
      "lib/driver-expense/market-actuals-form.test.ts",
      "lib/driver-expense/market-display-map.test.ts",
      "lib/driver-expense/fee-labels.test.ts",
      "lib/driver-expense/todo-list.test.ts",
      "lib/driver-expense/voucher-cost-apply.test.ts",
      "lib/unloading-calculator.test.ts",
      "lib/trip-cost-engine/vehicle-leg-resolver.test.ts",
      "lib/trip-cost-engine/line-cost-allocator.test.ts",
      "lib/trip-cost-engine/shadow-logger.test.ts",
      "lib/trip-cost-engine/shadow-compare.test.ts",
      "lib/trip-cost-engine/trip-cost-facade.test.ts",
      "lib/pnl-month-cache.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

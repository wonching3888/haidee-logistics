import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/inbound-crate-stock-account.test.ts",
      "lib/parse-year-month-params.test.ts",
      "lib/sadao-stock.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

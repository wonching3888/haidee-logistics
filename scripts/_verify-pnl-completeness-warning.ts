/**
 * Verify P&L incomplete-warning messages for Songkhla / Pattani.
 * Structural completeness only (missing cost labels / warning text).
 * Run: npx tsx --env-file=.env.local scripts/_verify-pnl-completeness-warning.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { detectThaiPnlCompleteness } from "../lib/thai-cost/pnl-completeness";
import { getSongkhlaPnl } from "../lib/thai-cost/songkhla-pnl";
import { getPattaniPnl } from "../lib/thai-cost/pattani-pnl";

async function main() {
  for (const [station, year, month] of [
    ["SONGKHLA", 2026, 6],
    ["PATTANI", 2026, 6],
  ] as const) {
    const c = await detectThaiPnlCompleteness(station, year, month);
    console.log(`\n=== ${station} ${year}-${month} ===`);
    console.log("missing:", c.missingCostLabels.join(" | ") || "(none)");
    console.log("warning:", c.incompleteWarning ?? "(none)");
  }

  const sk = await getSongkhlaPnl(2026, 6);
  const pt = await getPattaniPnl(2026, 6);
  console.log("\n=== via getSongkhlaPnl (THB vehicle PNL) ===");
  console.log("completeness:", sk.completeness.incompleteWarning);
  console.log("incomeThb:", sk.incomeThb, "costThb:", sk.costThb, "profitThb:", sk.profitThb);
  console.log("\n=== via getPattaniPnl (THB vehicle PNL) ===");
  console.log("completeness:", pt.completeness.incompleteWarning);
  console.log("incomeThb:", pt.incomeThb, "costThb:", pt.costThb, "profitThb:", pt.profitThb);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

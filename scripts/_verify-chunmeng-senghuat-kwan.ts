/**
 * End-to-end compute check (read-only, no writes): confirm the restored
 * dual-payment relations and the corrected KWAN G54 rate actually produce
 * the right THB/MYR amounts through computeInboundLineFreight(), not just
 * that the DB rows look structurally right.
 *
 * Run: npx tsx --env-file=.env.local scripts/_verify-chunmeng-senghuat-kwan.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "../lib/prisma";
import { parseDateInput } from "@/lib/date-utils";
import { loadInboundFreightContext } from "@/lib/freight-context";
import { computeInboundLineFreight } from "@/lib/inbound-freight";

async function computeFor(shipperCode: string, stallCode: string, marketCode: string, date: string, quantity = 10) {
  const shipper = await prisma.shipper.findUniqueOrThrow({ where: { code: shipperCode } });
  const stall = await prisma.stall.findFirstOrThrow({ where: { code: stallCode, market: { code: marketCode } } });
  const tongType = await prisma.tongType.findFirstOrThrow({ where: { isBox: false, active: true } });
  const { ctx } = await loadInboundFreightContext(
    shipper.id, [stall.id], [tongType.id], parseDateInput(date), shipper.pickupLocation
  );
  return computeInboundLineFreight({ stallId: stall.id, tongTypeId: tongType.id, quantity, mcDeliveryMode: null }, ctx);
}

function report(label: string, snapshot: any, expected: { thb?: number; myr?: number; mode?: string }) {
  console.log(`\n--- ${label} ---`);
  console.log("  paymentMode:", snapshot.paymentMode, " expected:", expected.mode ?? "(any)");
  console.log("  freightAmount:", snapshot.freightAmount, " expected:", expected.thb ?? expected.myr ?? "(n/a)");
  console.log("  dualPaymentWtlAmount:", snapshot.dualPaymentWtlAmount, " expected:", expected.myr && expected.thb ? expected.myr : "(n/a)");
}

async function main() {
  report("CHUN MENG + A56/H004 @ 2026-07-18", await computeFor("3001-C002", "A56", "A", "2026-07-18"),
    { mode: "1a", thb: 2600, myr: 90 });
  report("CHUN MENG + B51/S002 @ 2026-07-18", await computeFor("3001-C002", "B51", "A", "2026-07-18"),
    { mode: "1a", thb: 2600, myr: 90 });
  report("SENG HUAT + C42/W002 @ 2026-07-18", await computeFor("3001-S001", "C42", "KL", "2026-07-18"),
    { mode: "1a", thb: 2500, myr: 110 });

  // KWAN+G54 is single-mode (consignee-only), not dual -- just confirms which
  // rate tier gets picked up on each side of the 2026-07-01 boundary.
  report("KWAN + G54/H002 @ 2026-07-01 (new rate)", await computeFor("3001-K001", "G54", "KL", "2026-07-01"),
    { myr: 420 }); // 10 x 42
  report("KWAN + G54/H002 @ 2026-06-30 (old rate, history)", await computeFor("3001-K001", "G54", "KL", "2026-06-30"),
    { myr: 400 }); // 10 x 40
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

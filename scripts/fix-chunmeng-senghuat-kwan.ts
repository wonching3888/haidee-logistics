/**
 * Restore dual-payment PaymentRelations for CHUN MENG/SENG HUAT (deleted by
 * Sim; underlying FreightRate/ConsigneeFreightRate already correct, only the
 * relation row is missing) + correct KWAN's G54(3002-H002) tong rate 40->42
 * as a new effective-dated row (rateBox carried forward unchanged, per "box不动").
 * Does NOT touch KWAN+F40 -- pending confirmation on whether to restore it too.
 *
 * Run: npx tsx --env-file=.env.local scripts/fix-chunmeng-senghuat-kwan.ts --step=dry
 * Steps: dry (default, no writes) | apply | verify
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "../lib/prisma";
import { parseDateInput } from "@/lib/date-utils";

const NEW_EFFECTIVE_DATE = parseDateInput("2026-07-01"); // KWAN G54 tong 40->42，确认生效日

function stepArg() {
  const arg = process.argv.find((a) => a.startsWith("--step="));
  return arg?.split("=")[1] ?? "dry";
}

async function requireShipper(code: string) {
  const s = await prisma.shipper.findUnique({ where: { code } });
  if (!s) throw new Error(`Shipper not found: ${code}`);
  return s;
}
async function requireConsignee(code: string) {
  const c = await prisma.consignee.findUnique({ where: { code } });
  if (!c) throw new Error(`Consignee not found: ${code}`);
  return c;
}

async function restoreDualPayment(shipperCode: string, consigneeCode: string, label: string, dryRun: boolean) {
  const shipper = await requireShipper(shipperCode);
  const consignee = await requireConsignee(consigneeCode);
  const existing = await prisma.paymentRelation.findUnique({
    where: { shipperId_consigneeId: { shipperId: shipper.id, consigneeId: consignee.id } },
  });
  if (existing) {
    console.log(`${label}: already exists, SKIPPING (not overwriting) ->`, existing);
    return;
  }
  const data = {
    shipperId: shipper.id,
    consigneeId: consignee.id,
    paymentMode: "1a",
    dualPayment: true,
    secondaryConsigneeId: consignee.id,
    secondaryPaymentMode: "3",
  };
  if (dryRun) {
    console.log(`${label}: [DRY RUN] would create ->`, data);
    return;
  }
  await prisma.paymentRelation.create({ data });
  console.log(`${label}: created ->`, data);
}

async function correctKwanG54Rate(dryRun: boolean) {
  const consignee = await requireConsignee("3002-H002");
  const kl = await prisma.market.findUnique({ where: { code: "KL" } });
  if (!kl) throw new Error("KL market not found");

  const latest = await prisma.consigneeFreightRate.findFirst({
    where: { consigneeId: consignee.id, marketId: kl.id },
    orderBy: { effectiveDate: "desc" },
  });
  if (!latest) throw new Error("Expected an existing H002 x KL rate row (tong=40) -- none found, stopping.");
  console.log("Current latest H002 x KL row:", JSON.stringify(latest, null, 2));

  if (latest.rateTong?.toNumber() === 42) {
    console.log("rateTong already 42 -- nothing to do.");
    return;
  }

  const newRow = {
    consigneeId: consignee.id,
    marketId: kl.id,
    rateTong: 42,
    rateBox: latest.rateBox,
    rateTongThai: latest.rateTongThai,
    rateBoxThai: latest.rateBoxThai,
    sstApplicable: latest.sstApplicable,
    permitPerTrip: latest.permitPerTrip,
    effectiveDate: NEW_EFFECTIVE_DATE,
  };
  if (dryRun) {
    console.log("[DRY RUN] would create new row ->", newRow);
    return;
  }
  await prisma.consigneeFreightRate.create({ data: newRow });
  console.log("created new H002 x KL row ->", newRow);
}

async function main() {
  const step = stepArg();
  const dryRun = step === "dry";
  console.log(`=== step: ${step} ===\n`);

  await restoreDualPayment("3001-C002", "3002-H004", "CHUN MENG + H004", dryRun);
  await restoreDualPayment("3001-C002", "3002-S002", "CHUN MENG + S002", dryRun);
  await restoreDualPayment("3001-S001", "3002-W002", "SENG HUAT TAKOR + W002", dryRun);
  console.log("");
  await correctKwanG54Rate(dryRun);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

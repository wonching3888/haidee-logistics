/**
 * Backfill dualPaymentWtlConsigneeId semantics for historical rows.
 *
 * Context: inbound-freight.ts::computeInboundLineFreight used to set
 * dualPaymentWtlConsigneeId only when the computed dualPaymentWtlAmount was
 * > 0. That meant a dual-payment line whose secondary (WTL) rate was
 * missing at save time looked, in storage, IDENTICAL to a line that was
 * never part of a dual-payment relation at all — both had
 * dualPaymentWtlConsigneeId = NULL. Downstream gap classification
 * (classifyInboundFreightGap) and reporting (aggregateOperationsIncome,
 * findUnpricedInboundLines) depend on being able to tell these two cases
 * apart, so the code now sets dualPaymentWtlConsigneeId whenever the
 * PaymentRelation itself is dual-payment, regardless of whether a positive
 * amount was computed.
 *
 * This script is a ONE-TIME metadata backfill for rows saved under the old
 * code. It does NOT touch freightAmount, freightRate, dualPaymentWtlAmount,
 * dualPaymentWtlRate, or any other money field — only the consignee-id
 * label on rows that belong to a dual-payment relation but currently have
 * dualPaymentWtlConsigneeId = NULL. It is intentionally narrower and lower
 * risk than resaving whole sessions (see backfill-mode3-gap-snapshots.ts):
 * no rates are recomputed, so there is nothing to get wrong about money.
 *
 * Run: npx tsx --env-file=.env.local scripts/backfill-dual-payment-consignee-id.ts --step=all
 * Steps: backup | apply | verify | all (default: all)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";

const BACKUP_PATH = join(
  process.cwd(),
  "scripts",
  `backup-dual-payment-consignee-id-${new Date().toISOString().slice(0, 10)}.json`
);

function stepArg() {
  const arg = process.argv.find((a) => a.startsWith("--step="));
  return arg?.split("=")[1] ?? "all";
}

async function findDualPaymentRelations() {
  const relations = await prisma.paymentRelation.findMany({
    where: { dualPayment: true, secondaryConsigneeId: { not: null } },
    select: {
      id: true,
      shipperId: true,
      consigneeId: true,
      secondaryConsigneeId: true,
      shipper: { select: { code: true, name: true } },
      consignee: { select: { code: true, name: true } },
      secondaryConsignee: { select: { code: true, name: true } },
    },
  });
  console.log(`Found ${relations.length} dual-payment relation(s):`);
  for (const r of relations) {
    console.log(
      `  ${r.shipper.code} ${r.shipper.name} + ${r.consignee.code} ${r.consignee.name} -> secondary ${r.secondaryConsignee?.code} ${r.secondaryConsignee?.name}`
    );
  }
  return relations;
}

async function stepBackup() {
  const relations = await findDualPaymentRelations();
  const payload: {
    exportedAt: string;
    relations: typeof relations;
    affectedLines: Array<{
      id: string;
      sessionNo: string | null;
      shipperCode: string;
      consigneeCode: string | null;
      dualPaymentWtlAmount: string | null;
      dualPaymentWtlConsigneeIdBefore: string | null;
      expectedSecondaryConsigneeId: string;
      mismatch: boolean;
    }>;
  } = { exportedAt: new Date().toISOString(), relations, affectedLines: [] };

  for (const relation of relations) {
    const lines = await prisma.inboundLine.findMany({
      where: {
        session: { shipperId: relation.shipperId },
        consigneeId: relation.consigneeId,
      },
      select: {
        id: true,
        dualPaymentWtlAmount: true,
        dualPaymentWtlConsigneeId: true,
        session: { select: { sessionNo: true, shipper: { select: { code: true } } } },
        consignee: { select: { code: true } },
      },
    });

    for (const line of lines) {
      const before = line.dualPaymentWtlConsigneeId;
      // Flag (don't silently overwrite) any row that already points to a
      // DIFFERENT secondary consignee than this relation expects -- that
      // would mean the relation changed over time and needs a human look,
      // not a blind backfill.
      const mismatch =
        before != null && before !== relation.secondaryConsigneeId;
      payload.affectedLines.push({
        id: line.id,
        sessionNo: line.session.sessionNo,
        shipperCode: line.session.shipper.code,
        consigneeCode: line.consignee?.code ?? null,
        dualPaymentWtlAmount: line.dualPaymentWtlAmount?.toString() ?? null,
        dualPaymentWtlConsigneeIdBefore: before,
        expectedSecondaryConsigneeId: relation.secondaryConsigneeId!,
        mismatch,
      });
    }
  }

  const toBackfill = payload.affectedLines.filter(
    (l) => l.dualPaymentWtlConsigneeIdBefore == null
  );
  const mismatches = payload.affectedLines.filter((l) => l.mismatch);

  writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`\nBackup written: ${BACKUP_PATH}`);
  console.log(`Total dual-payment lines found: ${payload.affectedLines.length}`);
  console.log(`  -> NULL, will be backfilled: ${toBackfill.length}`);
  console.log(`  -> already correct: ${payload.affectedLines.length - toBackfill.length - mismatches.length}`);
  if (mismatches.length > 0) {
    console.log(
      `  -> MISMATCH (already set to a different consignee, NOT touched by --step=apply): ${mismatches.length}`
    );
    for (const m of mismatches) {
      console.log(
        `     line ${m.id} (${m.sessionNo}, ${m.shipperCode}): has ${m.dualPaymentWtlConsigneeIdBefore}, relation expects ${m.expectedSecondaryConsigneeId}`
      );
    }
  }
  return payload;
}

async function stepApply() {
  const relations = await findDualPaymentRelations();
  let totalUpdated = 0;

  for (const relation of relations) {
    // Resolve target row IDs first, then update by ID. This avoids relying
    // on nested relation filters inside updateMany's where clause and keeps
    // the write scoped to EXACTLY the rows the backup step reported.
    const targets = await prisma.inboundLine.findMany({
      where: {
        session: { shipperId: relation.shipperId },
        consigneeId: relation.consigneeId,
        dualPaymentWtlConsigneeId: null,
      },
      select: { id: true },
    });

    const result = targets.length
      ? await prisma.inboundLine.updateMany({
          where: { id: { in: targets.map((t) => t.id) } },
          data: { dualPaymentWtlConsigneeId: relation.secondaryConsigneeId },
        })
      : { count: 0 };

    console.log(
      `  ${relation.shipper.code} + ${relation.consignee.code}: updated ${result.count} row(s)`
    );
    totalUpdated += result.count;
  }

  console.log(`\nTotal rows backfilled: ${totalUpdated}`);
  return { totalUpdated };
}

async function stepVerify() {
  const relations = await findDualPaymentRelations();
  let stillNull = 0;
  let correct = 0;

  for (const relation of relations) {
    const lines = await prisma.inboundLine.findMany({
      where: {
        session: { shipperId: relation.shipperId },
        consigneeId: relation.consigneeId,
      },
      select: { id: true, dualPaymentWtlConsigneeId: true },
    });
    for (const line of lines) {
      if (line.dualPaymentWtlConsigneeId == null) stillNull += 1;
      else if (line.dualPaymentWtlConsigneeId === relation.secondaryConsigneeId) correct += 1;
    }
  }

  console.log("\n=== Verify ===");
  console.log(`Correctly set: ${correct}`);
  console.log(`Still NULL (expected 0 after --step=apply): ${stillNull}`);
  return { correct, stillNull };
}

async function main() {
  const step = stepArg();
  try {
    if (step === "all" || step === "backup") await stepBackup();
    if (step === "all" || step === "apply") await stepApply();
    if (step === "all" || step === "verify") await stepVerify();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

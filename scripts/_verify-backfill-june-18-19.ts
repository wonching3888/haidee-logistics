import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import {
  effectiveKpbFee,
  effectiveUnloadFee,
  lineSubtotal,
} from "../lib/unloading-calculator";

const TARGET_NOS = [
  "DO-20260618-003",
  "DO-20260618-004",
  "DO-20260618-005",
  "DO-20260619-001",
  "DO-20260619-002",
  "DO-20260619-003",
];

async function main() {
  let grandTotal = 0;
  const details: unknown[] = [];

  for (const no of TARGET_NOS) {
    const dispatch = await prisma.dispatchOrder.findFirst({
      where: { dispatchNo: no },
      select: { id: true, dispatchNo: true },
    });
    if (!dispatch) {
      details.push({ dispatchNo: no, error: "not found" });
      continue;
    }

    const fees = await prisma.unloadingFee.findMany({
      where: { tripId: dispatch.id },
      orderBy: { market: "asc" },
    });

    const tripTotal = fees.reduce(
      (sum, row) =>
        sum +
        lineSubtotal({
          unloadFee: row.unloadFee,
          kpbFee: row.kpbFee,
          unloadFeeOverride: row.unloadFeeOverride,
          kpbFeeOverride: row.kpbFeeOverride,
          isKpbExempt: row.isKpbExempt,
        }),
      0
    );
    grandTotal += tripTotal;

    details.push({
      dispatchNo: no,
      rowCount: fees.length,
      tripTotalMyr: Math.round(tripTotal * 100) / 100,
      markets: fees.map((r) => ({
        market: r.market,
        unloadFee: r.unloadFee,
        kpbFee: r.kpbFee,
        effective: lineSubtotal({
          unloadFee: r.unloadFee,
          kpbFee: r.kpbFee,
          unloadFeeOverride: r.unloadFeeOverride,
          kpbFeeOverride: r.kpbFeeOverride,
          isKpbExempt: r.isKpbExempt,
        }),
      })),
    });
  }

  console.log(
    JSON.stringify(
      {
        expectedGrandTotal: 1869.3,
        actualGrandTotal: Math.round(grandTotal * 100) / 100,
        match: Math.abs(grandTotal - 1869.3) < 0.02,
        details,
      },
      null,
      2
    )
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

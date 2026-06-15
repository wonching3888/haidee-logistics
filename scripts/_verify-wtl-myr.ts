import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { loadInboundFreightContext } from "@/lib/freight-context";
import { computeInboundLineFreight } from "@/lib/inbound-freight";
import { parseDateInput } from "@/lib/date-utils";

async function main() {
  const shipper = await prisma.shipper.findUnique({
    where: { code: "3000-B002" },
  });
  const market = await prisma.market.findUnique({ where: { code: "KL" } });
  const stall = await prisma.stall.findFirst({
    where: { marketId: market!.id, active: true },
  });
  const tong = await prisma.tongType.findFirst({
    where: { isBox: false, active: true },
  });

  const { ctx } = await loadInboundFreightContext(
    shipper!.id,
    [stall!.id],
    [tong!.id],
    parseDateInput("2026-06-15"),
    "SADAO"
  );
  const snapshot = computeInboundLineFreight(
    { stallId: stall!.id, tongTypeId: tong!.id, quantity: 10 },
    ctx
  );

  console.log(
    JSON.stringify(
      {
        paymentMode: snapshot.paymentMode,
        currency: snapshot.currency,
        thSegmentMyr: snapshot.thFreightAmount,
        mySegmentMyr: snapshot.mySegmentFreightAmount,
        totalMyr: snapshot.freightAmount,
        ratePerCrate: snapshot.freightRate,
        expectedPerCrate: 37.2,
        expectedTotal10: 372,
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());

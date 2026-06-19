/**
 * Verify partner trip invoice flow (creates test SKTN import, checks invoice, cleans up).
 * Run: npx tsx scripts/_verify-partner-trip-invoice.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  aggregatePartnerFreightIncomeMyr,
  ensurePartnerTripInvoice,
  formatPartnerInvoiceNo,
  listPartnerTripsForMonth,
} from "../lib/partner-freight";
import { aggregateOperationsIncome } from "../lib/operations-income";
import { SHIPPER_KIND } from "../lib/constants/shipper-kind";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const TEST_DATE = new Date("2026-06-18T00:00:00.000Z");
const TEST_QTY = 7;
const TEST_PLATE = "VERIFY-SKTN";
const TEST_MARKET = "KL";

async function main() {
  const tawakar = await prisma.shipper.findUnique({
    where: { code: "3000-T002" },
  });
  if (!tawakar) {
    throw new Error("TAWAKAR shipper 3000-T002 not found — run migrations first");
  }
  if (tawakar.shipperKind !== SHIPPER_KIND.LOGISTICS_PARTNER) {
    throw new Error(`TAWAKAR shipperKind expected logistics_partner, got ${tawakar.shipperKind}`);
  }

  const sktn = await prisma.tongType.findUnique({ where: { code: "SKTN" } });
  if (!sktn) throw new Error("SKTN tong type not found");

  let truck = await prisma.truck.findFirst({ where: { plate: TEST_PLATE } });
  if (!truck) {
    truck = await prisma.truck.create({
      data: { plate: TEST_PLATE, type: "big", country: "MY", active: true },
    });
  }

  const market = await prisma.market.findUnique({ where: { code: TEST_MARKET } });
  if (!market) throw new Error(`Market ${TEST_MARKET} not found`);

  const existingImport = await prisma.tongImport.findFirst({
    where: {
      date: TEST_DATE,
      truckId: truck.id,
      marketId: market.id,
      tongTypeId: sktn.id,
    },
  });

  let createdImportId: string | null = null;
  if (!existingImport) {
    const created = await prisma.tongImport.create({
      data: {
        date: TEST_DATE,
        truckId: truck.id,
        marketId: market.id,
        tongTypeId: sktn.id,
        quantity: TEST_QTY,
        status: "on_the_way",
      },
    });
    createdImportId = created.id;
  }

  const trips = await listPartnerTripsForMonth(2026, 6);
  const trip = trips.find(
    (row) =>
      row.truckPlate === TEST_PLATE &&
      row.marketCode === TEST_MARKET &&
      row.tripDateInput === "2026-06-18"
  );
  if (!trip) throw new Error("Expected partner trip row not found");
  if (trip.quantity < TEST_QTY) {
    throw new Error(`Expected qty >= ${TEST_QTY}, got ${trip.quantity}`);
  }
  const expectedAmount = Math.round(trip.quantity * 1.5 * 100) / 100;
  if (trip.amountMyr !== expectedAmount) {
    throw new Error(`Expected amount ${expectedAmount}, got ${trip.amountMyr}`);
  }

  const invoice = await ensurePartnerTripInvoice({
    tripDateInput: trip.tripDateInput,
    truckId: trip.truckId,
    marketId: trip.marketId,
    crateType: trip.crateType,
  });

  if (!invoice.invoiceNo.startsWith("EXP-2606-")) {
    throw new Error(`Unexpected invoice no: ${invoice.invoiceNo}`);
  }
  if (invoice.taxCode !== "ESV-6" || invoice.taxAmountMyr !== 0) {
    throw new Error("Expected ESV-6 with 0 tax");
  }
  if (invoice.amountMyr !== expectedAmount) {
    throw new Error(`Invoice amount mismatch: ${invoice.amountMyr}`);
  }

  const partnerIncome = await aggregatePartnerFreightIncomeMyr(2026, 6);
  const opsIncome = await aggregateOperationsIncome(2026, 6);
  if (opsIncome.partnerFreightMyr < expectedAmount) {
    throw new Error("partnerFreightMyr not reflected in operations income");
  }

  const inboundShippers = await prisma.shipper.findMany({
    where: { active: true, code: "3000-T002" },
    select: { id: true },
  });
  const inboundList = await prisma.shipper.findMany({
    where: {
      active: true,
      shipperKind: SHIPPER_KIND.OPERATIONAL,
      code: "3000-T002",
    },
  });
  if (inboundList.length > 0) {
    throw new Error("TAWAKAR should not be operational shipper");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tawakar: { code: tawakar.code, name: tawakar.name, shipperKind: tawakar.shipperKind },
        trip: {
          truckPlate: trip.truckPlate,
          market: trip.marketCode,
          quantity: trip.quantity,
          amountMyr: trip.amountMyr,
        },
        invoice: {
          invoiceNo: invoice.invoiceNo,
          taxCode: invoice.taxCode,
          taxAmountMyr: invoice.taxAmountMyr,
          totalMyr: invoice.totalMyr,
        },
        operations: {
          partnerFreightMyr: opsIncome.partnerFreightMyr,
          wtlShipperMyr: opsIncome.wtlShipperMyr,
        },
        partnerIncomeMonth: partnerIncome,
        sampleInvoiceFormat: formatPartnerInvoiceNo(2026, 6, 1),
        tawakarInInboundQuery: inboundShippers.length > 0,
        note: "Test import left in DB if pre-existing; new import cleaned below",
      },
      null,
      2
    )
  );

  if (createdImportId) {
    await prisma.tongImport.delete({ where: { id: createdImportId } });
    await prisma.partnerTripInvoice.deleteMany({
      where: {
        tripDate: TEST_DATE,
        truckId: truck.id,
        marketId: market.id,
        crateType: "SKTN",
      },
    });
    console.log("Cleaned up test tong_import and partner_trip_invoice rows.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

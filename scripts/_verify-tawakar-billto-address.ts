/**
 * Verify partner trip invoice Bill-to address (3-line layout) + invoice fields.
 * Run: npx tsx scripts/_verify-tawakar-billto-address.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ensurePartnerTripInvoice, listPartnerTripsForMonth } from "../lib/partner-freight";
import { SHIPPER_KIND } from "../lib/constants/shipper-kind";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EXPECTED_LINES = [
  "NO 6839, JALAN PERMATANG PAUH,",
  "13400 BUTTERWORTH,",
  "PENANG.",
];
const EXPECTED_ADDRESS = EXPECTED_LINES.join("\n");
const TEST_DATE = new Date("2026-06-18T00:00:00.000Z");
const TEST_QTY = 7;
const TEST_PLATE = "VERIFY-SKTN";
const TEST_MARKET = "KL";

async function main() {
  const tawakar = await prisma.shipper.findUniqueOrThrow({
    where: { code: "3000-T002" },
    select: { code: true, name: true, location: true, shipperKind: true },
  });
  if (tawakar.shipperKind !== SHIPPER_KIND.LOGISTICS_PARTNER) {
    throw new Error(`Expected logistics_partner, got ${tawakar.shipperKind}`);
  }
  if (tawakar.location !== EXPECTED_ADDRESS) {
    throw new Error(`TAWAKAR location mismatch:\n${tawakar.location}`);
  }

  const sktn = await prisma.tongType.findUniqueOrThrow({ where: { code: "SKTN" } });
  let truck = await prisma.truck.findFirst({ where: { plate: TEST_PLATE } });
  if (!truck) {
    truck = await prisma.truck.create({
      data: { plate: TEST_PLATE, type: "big", country: "MY", active: true },
    });
  }
  const market = await prisma.market.findUniqueOrThrow({ where: { code: TEST_MARKET } });

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

  const trips = await listPartnerTripsForMonth(2026, 6);
  const trip = trips.find(
    (t) => t.truckPlate === TEST_PLATE && t.tripDateInput === "2026-06-18"
  );
  if (!trip) throw new Error("trip not found");
  if (trip.quantity < TEST_QTY) throw new Error(`qty expected ${TEST_QTY}, got ${trip.quantity}`);

  const expectedAmount = Math.round(trip.quantity * 1.5 * 100) / 100;
  if (trip.amountMyr !== expectedAmount) {
    throw new Error(`amount expected ${expectedAmount}, got ${trip.amountMyr}`);
  }

  const invoice = await ensurePartnerTripInvoice({
    tripDateInput: trip.tripDateInput,
    truckId: trip.truckId,
    marketId: trip.marketId,
    crateType: trip.crateType,
  });

  const addressLines = (invoice.billToLocation ?? "").split("\n");
  const threeLineOk =
    addressLines.length === 3 &&
    addressLines.every((line, i) => line === EXPECTED_LINES[i]);

  if (!invoice.invoiceNo.startsWith("EXP-2606-")) {
    throw new Error(`invoice no expected EXP-2606-*, got ${invoice.invoiceNo}`);
  }
  if (invoice.taxCode !== "ESV-6" || invoice.taxAmountMyr !== 0) {
    throw new Error("tax expected ESV-6 / 0");
  }
  if (invoice.amountMyr !== expectedAmount) {
    throw new Error(`invoice amount expected ${expectedAmount}, got ${invoice.amountMyr}`);
  }
  if (!threeLineOk) {
    throw new Error(`address not 3 lines: ${JSON.stringify(addressLines)}`);
  }

  // whitespace-pre-line renders \n as line breaks (not collapsed to spaces)
  const printClassHint = "whitespace-pre-line";

  console.log(
    JSON.stringify(
      {
        ok: true,
        threeLineOk,
        addressLines,
        printClassHint,
        invoice: {
          invoiceNo: invoice.invoiceNo,
          taxCode: invoice.taxCode,
          taxAmountMyr: invoice.taxAmountMyr,
          amountMyr: invoice.amountMyr,
          totalMyr: invoice.totalMyr,
        },
        billTo: {
          name: invoice.billToName,
          code: invoice.billToCode,
          location: invoice.billToLocation,
        },
        trip: {
          truckPlate: trip.truckPlate,
          market: trip.marketCode,
          quantity: trip.quantity,
        },
      },
      null,
      2
    )
  );

  await prisma.partnerTripInvoice.deleteMany({
    where: {
      tripDate: TEST_DATE,
      truckId: truck.id,
      marketId: market.id,
      crateType: "SKTN",
    },
  });
  await prisma.tongImport.delete({ where: { id: created.id } });
  console.log("Cleaned up test data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

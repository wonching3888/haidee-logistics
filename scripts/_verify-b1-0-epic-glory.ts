/**
 * Verify B1-0 Epic Glory shipper + GLY crate return rate.
 * Run: npx tsx scripts/_verify-b1-0-epic-glory.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import { isLogisticsPartnerShipper } from "../lib/constants/shipper-kind";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EXPECTED_LOCATION_LINES = [
  "3A, 1ST FLOOR, JALAN TUANKU HAMINAH 1,",
  "TAMAN TUANKU HAMINAH,",
  "08000 SUNGAI PETANI, KEDAH.",
];

async function checkMonthlyInvoiceCustomers(year: number, month: number) {
  const { start, end } = getMonthDateRange(year, month);
  const lines = await prisma.inboundLine.findMany({
    where: {
      freightAmount: { gt: 0 },
      session: {
        status: "confirmed",
        date: { gte: start, lte: end },
        shipper: { code: "3002-E001" },
      },
    },
    select: { id: true },
    take: 1,
  });
  const epicInboundLines = lines.length;

  const shipperInDb = await prisma.shipper.findUnique({
    where: { code: "3002-E001" },
    select: { id: true, code: true, name: true },
  });

  return {
    epicInboundLines,
    wouldAppearInMonthlyInvoice: epicInboundLines > 0,
    note:
      epicInboundLines === 0
        ? "No inbound freight lines — Epic Glory will not appear in Mode 1-4 customer picker"
        : "Has inbound lines — would appear in monthly invoice",
    shipperExists: shipperInDb != null,
  };
}

async function main() {
  const epic = await prisma.shipper.findUnique({
    where: { code: "3002-E001" },
    select: {
      id: true,
      code: true,
      name: true,
      location: true,
      company: true,
      currency: true,
      shipperKind: true,
      paymentParty: true,
      pickupLocation: true,
      defaultTongTypeId: true,
      active: true,
    },
  });
  if (!epic) throw new Error("Epic Glory 3002-E001 not found");

  const glyRate = await prisma.crateReturnFreightRate.findUnique({
    where: { crateType: "GLY" },
    include: {
      billToShipper: { select: { code: true, name: true, shipperKind: true } },
    },
  });
  if (!glyRate) throw new Error("GLY crate return rate not found");

  const locationLines = (epic.location ?? "").split("\n");
  const locationOk =
    locationLines.length === 3 &&
    locationLines.every((line, i) => line === EXPECTED_LOCATION_LINES[i]);

  const epicOk =
    epic.name === "EPIC GLORY SDN BHD" &&
    epic.company === "haidee" &&
    epic.currency === "MYR" &&
    epic.shipperKind === "operational" &&
    epic.paymentParty === "shipper" &&
    epic.pickupLocation === "SADAO" &&
    epic.defaultTongTypeId === null &&
    epic.active === true &&
    locationOk &&
    !isLogisticsPartnerShipper(epic);

  const glyOk =
    glyRate.billToShipperId === epic.id &&
    glyRate.billToShipper.code === "3002-E001" &&
    Number(glyRate.freightRateMyr) === 1.5 &&
    Number(glyRate.collectionRateMyr) === 0 &&
    glyRate.active === true;

  const monthlyCheck = await checkMonthlyInvoiceCustomers(2026, 6);

  const allRates = await prisma.crateReturnFreightRate.findMany({
    include: { billToShipper: { select: { code: true, name: true } } },
    orderBy: { crateType: "asc" },
  });

  console.log(
    JSON.stringify(
      {
        ok: epicOk && glyOk && !monthlyCheck.wouldAppearInMonthlyInvoice,
        epicGlory: {
          ...epic,
          locationLines,
          locationOk,
          isLogisticsPartner: isLogisticsPartnerShipper(epic),
        },
        glyRate: {
          crateType: glyRate.crateType,
          freightRateMyr: Number(glyRate.freightRateMyr),
          collectionRateMyr: Number(glyRate.collectionRateMyr),
          active: glyRate.active,
          billTo: glyRate.billToShipper,
        },
        crateReturnRates: allRates.map((r) => ({
          crateType: r.crateType,
          freight: Number(r.freightRateMyr),
          collection: Number(r.collectionRateMyr),
          billToCode: r.billToShipper.code,
        })),
        monthlyInvoiceIsolation: monthlyCheck,
      },
      null,
      2
    )
  );

  if (!epicOk || !glyOk) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Create Tawakar shipper master data (bill-to for SKTN empty-crate returns).
 *
 * Run after filling in TAWAKAR_SHIPPER below:
 *   npx tsx scripts/create-tawakar-shipper.ts
 *
 * Required before Phase B (crate-return monthly invoice).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

/** Fill in from Autocount / business before running. */
const TAWAKAR_SHIPPER = {
  /** Autocount customer code (unique), e.g. "3002-T00X" */
  code: "",
  /** Display name, e.g. "TAWAKAR" */
  name: "",
  /** Thai name (optional) */
  nameTh: null as string | null,
  /** Phone (optional) */
  phone: null as string | null,
  /** Line ID (optional) */
  lineId: null as string | null,
  /** Location / address notes (optional) */
  location: null as string | null,
  /** SADAO | SONGKHLA | PATTANI — default SADAO unless told otherwise */
  pickupLocation: "SADAO" as const,
  /** shipper | consignee — who pays freight on inbound (if any) */
  paymentParty: "shipper" as const,
  /** haidee | wtl — billing company */
  company: "haidee" as const,
  /** MYR for crate-return billing per business case */
  currency: "MYR" as const,
  /** Default tong type for inbound — leave null (Tawakar has no inbound tong) */
  defaultTongTypeId: null as string | null,
  active: true,
};

async function main() {
  if (!TAWAKAR_SHIPPER.code.trim() || !TAWAKAR_SHIPPER.name.trim()) {
    console.error(
      "Set TAWAKAR_SHIPPER.code and TAWAKAR_SHIPPER.name in scripts/create-tawakar-shipper.ts before running."
    );
    process.exit(1);
  }

  const existing = await prisma.shipper.findUnique({
    where: { code: TAWAKAR_SHIPPER.code },
  });
  if (existing) {
    console.log(`Shipper already exists: ${existing.code} (${existing.name})`);
    return;
  }

  const shipper = await prisma.shipper.create({
    data: {
      code: TAWAKAR_SHIPPER.code.trim(),
      name: TAWAKAR_SHIPPER.name.trim(),
      nameTh: TAWAKAR_SHIPPER.nameTh,
      phone: TAWAKAR_SHIPPER.phone,
      lineId: TAWAKAR_SHIPPER.lineId,
      location: TAWAKAR_SHIPPER.location,
      pickupLocation: TAWAKAR_SHIPPER.pickupLocation,
      paymentParty: TAWAKAR_SHIPPER.paymentParty,
      company: TAWAKAR_SHIPPER.company,
      currency: TAWAKAR_SHIPPER.currency,
      defaultTongTypeId: TAWAKAR_SHIPPER.defaultTongTypeId,
      active: TAWAKAR_SHIPPER.active,
    },
  });

  console.log(`Created Tawakar shipper: ${shipper.code} (${shipper.name}) id=${shipper.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

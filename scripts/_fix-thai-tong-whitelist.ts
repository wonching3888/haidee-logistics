import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  addCrateExportMismatchWhitelistEntry,
  removeCrateExportMismatchWhitelistEntry,
} from "../lib/crate-export-mismatch-whitelist-service";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  await removeCrateExportMismatchWhitelistEntry(
    "59ceaaf5-5fb8-4108-89c6-f91c7e1d1f56"
  );
  const thaiTongFishery = await prisma.shipper.findFirst({
    where: { name: "THAI TONG FISHERY" },
    select: { id: true, name: true, code: true },
  });
  if (!thaiTongFishery) throw new Error("THAI TONG FISHERY not found");
  await addCrateExportMismatchWhitelistEntry({
    shipperId: thaiTongFishery.id,
    note: "VIO full-truck policy — skip mismatch highlight",
  });
  console.log("fixed whitelist:", thaiTongFishery);
}

main().finally(() => prisma.$disconnect());

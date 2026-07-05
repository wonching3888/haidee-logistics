import { prisma } from "@/lib/prisma";

export type CrateExportMismatchWhitelistRow = {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  note: string | null;
  createdAt: Date;
};

export async function loadCrateExportMismatchWhitelistShipperIds(): Promise<
  Set<string>
> {
  const rows = await prisma.crateExportMismatchWhitelist.findMany({
    select: { shipperId: true },
  });
  return new Set(rows.map((row) => row.shipperId));
}

export async function listCrateExportMismatchWhitelist(): Promise<
  CrateExportMismatchWhitelistRow[]
> {
  const rows = await prisma.crateExportMismatchWhitelist.findMany({
    include: {
      shipper: { select: { code: true, name: true } },
    },
    orderBy: { shipper: { name: "asc" } },
  });
  return rows.map((row) => ({
    shipperId: row.shipperId,
    shipperCode: row.shipper.code,
    shipperName: row.shipper.name,
    note: row.note,
    createdAt: row.createdAt,
  }));
}

export async function addCrateExportMismatchWhitelistEntry(input: {
  shipperId: string;
  note?: string | null;
  createdById?: string | null;
}): Promise<void> {
  const shipperId = input.shipperId.trim();
  if (!shipperId) return;

  await prisma.crateExportMismatchWhitelist.upsert({
    where: { shipperId },
    create: {
      shipperId,
      note: input.note?.trim() || null,
      createdById: input.createdById ?? null,
    },
    update: {
      note: input.note?.trim() || null,
    },
  });
}

export async function removeCrateExportMismatchWhitelistEntry(
  shipperId: string
): Promise<void> {
  await prisma.crateExportMismatchWhitelist.deleteMany({
    where: { shipperId: shipperId.trim() },
  });
}

import type { Prisma } from "@prisma/client";
import type { CrateStockRowSnapshot } from "@/lib/crate-stock-agent-transfer";
import { buildCrateStockSnapshots } from "@/lib/crate-stock-agent-transfer";

function normalizeLocation(location?: string | null): string {
  return location?.trim() ?? "";
}

function stockWhere(
  shipperId: string,
  crateTypeId: string,
  location?: string | null
) {
  return {
    shipperId_crateTypeId_location: {
      shipperId,
      crateTypeId,
      location: normalizeLocation(location),
    },
  };
}

async function applyStockDeltaInTx(
  tx: Prisma.TransactionClient,
  input: {
    shipperId: string;
    crateTypeId: string;
    location: string;
    targetQuantity: number;
    changeType: string;
    notes?: string | null;
  }
) {
  const loc = normalizeLocation(input.location);
  const existing = await tx.customerCrateStock.findUnique({
    where: stockWhere(input.shipperId, input.crateTypeId, loc),
    select: { quantity: true },
  });
  const previousQty = existing?.quantity ?? 0;
  const delta = input.targetQuantity - previousQty;
  if (delta === 0) return;

  await tx.customerCrateStock.upsert({
    where: stockWhere(input.shipperId, input.crateTypeId, loc),
    create: {
      shipperId: input.shipperId,
      crateTypeId: input.crateTypeId,
      location: loc,
      quantity: input.targetQuantity,
    },
    update: { quantity: input.targetQuantity },
  });

  await tx.customerCrateLedger.create({
    data: {
      shipperId: input.shipperId,
      crateTypeId: input.crateTypeId,
      location: loc,
      changeType: input.changeType,
      quantity: delta,
      balance: input.targetQuantity,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function captureMemberStockSnapshotInTx(
  tx: Prisma.TransactionClient,
  memberShipperId: string
): Promise<CrateStockRowSnapshot[]> {
  const rows = await tx.customerCrateStock.findMany({
    where: { shipperId: memberShipperId },
    select: { crateTypeId: true, location: true, quantity: true },
  });
  return buildCrateStockSnapshots(rows);
}

export async function transferMemberStockToAgentInTx(
  tx: Prisma.TransactionClient,
  input: {
    agentShipperId: string;
    agentShipperName: string;
    memberShipperId: string;
    memberShipperName: string;
    skipTransfer: boolean;
  }
): Promise<CrateStockRowSnapshot[]> {
  const snapshot = await captureMemberStockSnapshotInTx(
    tx,
    input.memberShipperId
  );
  if (input.skipTransfer) return snapshot;

  for (const row of snapshot) {
    const agentRow = await tx.customerCrateStock.findUnique({
      where: stockWhere(
        input.agentShipperId,
        row.crateTypeId,
        row.location
      ),
      select: { quantity: true },
    });
    const agentQty = (agentRow?.quantity ?? 0) + row.quantity;

    await applyStockDeltaInTx(tx, {
      shipperId: input.agentShipperId,
      crateTypeId: row.crateTypeId,
      location: row.location,
      targetQuantity: agentQty,
      changeType: "agent-join-transfer-in",
      notes: `via=${input.memberShipperName}`,
    });

    await applyStockDeltaInTx(tx, {
      shipperId: input.memberShipperId,
      crateTypeId: row.crateTypeId,
      location: row.location,
      targetQuantity: 0,
      changeType: "agent-join-transfer-out",
      notes: `via=${input.agentShipperName}`,
    });
  }

  return snapshot;
}

export async function zeroMemberStockOnRemoveInTx(
  tx: Prisma.TransactionClient,
  input: {
    memberShipperId: string;
    agentShipperName: string;
  }
): Promise<CrateStockRowSnapshot[]> {
  const rows = await tx.customerCrateStock.findMany({
    where: { shipperId: input.memberShipperId },
    select: { crateTypeId: true, location: true, quantity: true },
  });
  const snapshot = buildCrateStockSnapshots(rows);

  for (const row of rows) {
    if (row.quantity === 0) continue;
    await applyStockDeltaInTx(tx, {
      shipperId: input.memberShipperId,
      crateTypeId: row.crateTypeId,
      location: row.location,
      targetQuantity: 0,
      changeType: "agent-remove-zero",
      notes: `via=${input.agentShipperName}`,
    });
  }

  return snapshot;
}

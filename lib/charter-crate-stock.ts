import type { Prisma } from "@prisma/client";
import {
  addCustomerCratesBatch,
  deductCustomerCratesBatch,
} from "@/app/actions/customerCrateStock";
import { resolveCustomerCrateStockAccount } from "@/lib/customer-crate-stock-account";
import { listCrateRentalRates } from "@/lib/crate-rental-rates-service";
import { prisma } from "@/lib/prisma";

export interface CharterCrateStockLine {
  tongTypeId: string;
  tongTypeCode: string;
  quantity: number;
  isBox: boolean;
}

function aggregateRentalCrateQuantities(
  lines: CharterCrateStockLine[],
  rentalByCode: Map<string, boolean>
) {
  const byCrateType = new Map<string, number>();
  for (const line of lines) {
    if (line.quantity <= 0 || line.isBox) continue;
    if (!rentalByCode.get(line.tongTypeCode)) continue;
    byCrateType.set(
      line.tongTypeId,
      (byCrateType.get(line.tongTypeId) ?? 0) + line.quantity
    );
  }
  return byCrateType;
}

async function loadRentalByCode() {
  const rates = await listCrateRentalRates();
  return new Map(rates.map((row) => [row.crateType, row.isRental]));
}

/** Notes written by applyCharterCrateDeduction: `包车扣减 Charter ${charterNo}`. */
export function charterNoInCharterDeductionNotes(charterNo: string): string {
  return `Charter ${charterNo.trim()}`;
}

/**
 * Reverse path: use latest actual charter deduction ledger location (not trip field).
 * Falls back to resolveCharterStockContext when no charter ledger exists yet.
 */
export async function resolveCharterReverseStockContext(input: {
  charterNo: string | null | undefined;
  shipperId: string;
  customerOriginLocation?: string | null;
}): Promise<{ shipperId: string; stockLocation: string }> {
  const trimmed = input.charterNo?.trim();
  if (trimmed) {
    const ledger = await prisma.customerCrateLedger.findFirst({
      where: {
        changeType: "charter",
        shipperId: input.shipperId,
        notes: { contains: charterNoInCharterDeductionNotes(trimmed) },
      },
      orderBy: { createdAt: "desc" },
      select: { shipperId: true, location: true },
    });
    if (ledger) {
      return { shipperId: ledger.shipperId, stockLocation: ledger.location };
    }
  }

  const { stockLocation } = await resolveCharterStockContext(
    input.shipperId,
    input.customerOriginLocation
  );
  return { shipperId: input.shipperId, stockLocation };
}

export async function resolveCharterCrateStockAccount(
  shipperId: string,
  customerOriginLocation?: string | null
) {
  const shipper = await prisma.shipper.findUnique({
    where: { id: shipperId },
    select: { pickupLocation: true, isMultiOriginCustomer: true },
  });
  if (!shipper) throw new Error("寄货人不存在 Shipper not found");

  return resolveCustomerCrateStockAccount({
    operationalShipperId: shipperId,
    shipperPickupLocation: shipper.pickupLocation,
    sessionPickupLocation: null,
    customerOriginLocation,
    isMultiOriginCustomer: shipper.isMultiOriginCustomer,
    areaNote: null,
  });
}

export async function applyCharterCrateDeduction(input: {
  shipperId: string;
  stockLocation: string;
  lines: CharterCrateStockLine[];
  charterNo?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const rentalByCode = await loadRentalByCode();
  const byCrateType = aggregateRentalCrateQuantities(input.lines, rentalByCode);
  const deductions = Array.from(byCrateType.entries()).map(
    ([crateTypeId, quantity]) => ({ crateTypeId, quantity })
  );
  if (deductions.length === 0) return;

  const note = input.charterNo
    ? `包车扣减 Charter ${input.charterNo}`
    : "包车扣减 Charter stock deduction";

  await deductCustomerCratesBatch(
    input.shipperId,
    deductions,
    "charter",
    input.stockLocation,
    note,
    input.tx
  );
}

export async function reverseCharterCrateDeduction(input: {
  shipperId: string;
  stockLocation: string;
  lines: CharterCrateStockLine[];
  charterNo?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const rentalByCode = await loadRentalByCode();
  const byCrateType = aggregateRentalCrateQuantities(input.lines, rentalByCode);
  const additions = Array.from(byCrateType.entries()).map(
    ([crateTypeId, quantity]) => ({ crateTypeId, quantity })
  );
  if (additions.length === 0) return;

  const note = input.charterNo
    ? `包车撤销 Charter reverse ${input.charterNo}`
    : "包车撤销 Charter stock reversal";

  await addCustomerCratesBatch(
    input.shipperId,
    additions,
    "charter-reverse",
    input.stockLocation,
    note,
    input.tx
  );
}

export async function resolveCharterStockContext(
  shipperId: string,
  customerOriginLocation?: string | null
) {
  const account = await resolveCharterCrateStockAccount(
    shipperId,
    customerOriginLocation
  );

  return { stockLocation: account.location };
}

export async function charterLinesToStockLines(
  lines: Array<{ tongTypeId: string; quantity: number }>
): Promise<CharterCrateStockLine[]> {
  if (lines.length === 0) return [];

  const tongTypes = await prisma.tongType.findMany({
    where: { id: { in: lines.map((line) => line.tongTypeId) } },
    select: { id: true, code: true, isBox: true },
  });
  const tongById = new Map(tongTypes.map((t) => [t.id, t]));

  return lines
    .map((line) => {
      const tong = tongById.get(line.tongTypeId);
      if (!tong || line.quantity <= 0) return null;
      return {
        tongTypeId: line.tongTypeId,
        tongTypeCode: tong.code,
        quantity: line.quantity,
        isBox: tong.isBox,
      };
    })
    .filter((line): line is CharterCrateStockLine => line != null);
}

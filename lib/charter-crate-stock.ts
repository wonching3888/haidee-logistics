import {
  addCustomerCratesBatch,
  deductCustomerCratesBatch,
} from "@/app/actions/customerCrateStock";
import {
  resolveInboundCrateStockLocation,
  resolveSessionPickupLocation,
} from "@/lib/constants/pickup-locations";
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

export async function resolveCharterCrateStockLocation(input: {
  shipperPickupLocation: string | null | undefined;
  stockAreaNote?: string | null;
}) {
  const pickup = resolveSessionPickupLocation(null, input.shipperPickupLocation);
  return resolveInboundCrateStockLocation(pickup, input.stockAreaNote ?? null);
}

export async function applyCharterCrateDeduction(input: {
  shipperId: string;
  stockLocation: string;
  lines: CharterCrateStockLine[];
  charterNo?: string | null;
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
    note
  );
}

export async function reverseCharterCrateDeduction(input: {
  shipperId: string;
  stockLocation: string;
  lines: CharterCrateStockLine[];
  charterNo?: string | null;
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
    note
  );
}

export async function resolveCharterStockContext(shipperId: string, stockAreaNote?: string | null) {
  const shipper = await prisma.shipper.findUnique({
    where: { id: shipperId },
    select: { pickupLocation: true },
  });
  if (!shipper) throw new Error("寄货人不存在 Shipper not found");

  const stockLocation = await resolveCharterCrateStockLocation({
    shipperPickupLocation: shipper.pickupLocation,
    stockAreaNote,
  });

  return { stockLocation };
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

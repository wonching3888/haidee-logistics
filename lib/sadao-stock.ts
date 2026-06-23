export interface TongTypeStockMeta {
  id: string;
  code: string;
  name: string;
}

export interface SadaoStockRow {
  tongTypeId: string;
  code: string;
  name: string;
  stock: number;
}

export function computeSadaoStockByTongType(input: {
  tongTypes: TongTypeStockMeta[];
  importQtyByTongTypeId: Record<string, number>;
  exportQtyByTongTypeId: Record<string, number>;
  adjustmentQtyByTongTypeId?: Record<string, number>;
}): Record<string, SadaoStockRow> {
  const adjustmentQtyByTongTypeId = input.adjustmentQtyByTongTypeId ?? {};
  const result: Record<string, SadaoStockRow> = {};

  for (const tongType of input.tongTypes) {
    const imported = input.importQtyByTongTypeId[tongType.id] ?? 0;
    const exported = input.exportQtyByTongTypeId[tongType.id] ?? 0;
    const adjusted = adjustmentQtyByTongTypeId[tongType.id] ?? 0;

    result[tongType.code] = {
      tongTypeId: tongType.id,
      code: tongType.code,
      name: tongType.name,
      stock: imported - exported + adjusted,
    };
  }

  return result;
}

/** Delta to apply when user sets an absolute SADAO stock target. */
export function computeTongStockDeltaForTarget(
  currentStock: number,
  targetStock: number
): number {
  return targetStock - currentStock;
}

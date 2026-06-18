import { isBoxColumn, mapTongToColumn, emptyQuantities } from "@/lib/constants/tong-columns";

export type DOMergeMode = "bySession" | "byShipperAndStall";

export interface DORow {
  lorryNo: string;
  consignor: string;
  store: string;
  area: string;
  quantities: Record<string, number>;
  qty: number;
}

export interface InboundLineForDOMerge {
  sessionId: string;
  stallId: string;
  shipperId: string;
  consignor: string;
  store: string;
  area: string;
  tongCode: string;
  quantity: number;
}

function buildDORow(
  lorryNo: string,
  consignor: string,
  store: string,
  area: string,
  tongCode: string,
  quantity: number
): DORow {
  const quantities = emptyQuantities();
  const col = mapTongToColumn(tongCode);
  quantities[col] = quantity;
  return {
    lorryNo,
    consignor,
    store,
    area,
    quantities,
    qty: isBoxColumn(col) ? 0 : quantity,
  };
}

function mergeDORowQuantities(existing: DORow, tongCode: string, quantity: number) {
  const col = mapTongToColumn(tongCode);
  existing.quantities[col] = (existing.quantities[col] ?? 0) + quantity;
  if (!isBoxColumn(col)) {
    existing.qty += quantity;
  }
}

function mergeKey(line: InboundLineForDOMerge, mode: DOMergeMode): string {
  if (mode === "byShipperAndStall") {
    return `${line.shipperId}:${line.stallId}`;
  }
  return `${line.sessionId}:${line.stallId}`;
}

export function mergeDORows(
  lorryNo: string,
  lines: InboundLineForDOMerge[],
  mode: DOMergeMode = "bySession"
): DORow[] {
  const rowMap = new Map<string, DORow>();

  for (const line of lines) {
    const key = mergeKey(line, mode);
    const existing = rowMap.get(key);
    if (existing) {
      mergeDORowQuantities(existing, line.tongCode, line.quantity);
    } else {
      rowMap.set(
        key,
        buildDORow(
          lorryNo,
          line.consignor,
          line.store,
          line.area,
          line.tongCode,
          line.quantity
        )
      );
    }
  }

  return Array.from(rowMap.values());
}

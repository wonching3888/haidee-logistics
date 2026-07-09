import { TONG_IMPORT_DEFAULT_COLUMNS } from "@/lib/constants/tong-import-columns";

/** Stored in tong_imports.notes when clerk confirms no crate return for a trip. */
export const CRATE_IMPORT_NO_RETURN_NOTE = "NO_RETURN";

/** Stored when market is set but driver has not reported crate quantities yet. */
export const CRATE_IMPORT_PENDING_QTY_NOTE = "PENDING_QTY";

export type CrateImportRowState =
  | "pending"
  | "awaiting_qty"
  | "recorded"
  | "no_return";

export interface CrateImportRowShape {
  truckPlate: string;
  marketCode: string;
  quantities: Record<string, string>;
  notes?: string;
  status?: "on_the_way" | "arrived";
  noReturn?: boolean;
  awaitingQty?: boolean;
}

export function emptyCrateImportQuantities(): Record<string, string> {
  return Object.fromEntries(
    TONG_IMPORT_DEFAULT_COLUMNS.map((c) => [c.key, ""])
  );
}

export function crateImportRowKey(truckPlate: string, marketCode: string) {
  return `${truckPlate.trim()}|${marketCode.trim()}`;
}

export function parseCrateImportRowKey(key: string) {
  const [truckPlate, marketCode] = key.split("|");
  return { truckPlate: truckPlate ?? "", marketCode: marketCode ?? "" };
}

export function rowHasPositiveCrateQty(
  quantities: Record<string, string>,
  dynamicColumnKeys: string[] = []
): boolean {
  for (const col of TONG_IMPORT_DEFAULT_COLUMNS) {
    const qty = parseInt(quantities[col.key] ?? "0", 10) || 0;
    if (qty > 0) return true;
  }
  for (const key of dynamicColumnKeys) {
    const qty = parseInt(quantities[key] ?? "0", 10) || 0;
    if (qty > 0) return true;
  }
  return false;
}

export function deriveCrateImportRowState(
  row: CrateImportRowShape,
  dynamicColumnKeys: string[] = []
): CrateImportRowState {
  if (row.noReturn || row.notes === CRATE_IMPORT_NO_RETURN_NOTE) {
    return "no_return";
  }
  if (rowHasPositiveCrateQty(row.quantities, dynamicColumnKeys)) {
    return "recorded";
  }
  if (row.awaitingQty || row.notes === CRATE_IMPORT_PENDING_QTY_NOTE) {
    return "awaiting_qty";
  }
  return "pending";
}

/** Merge dispatch-day trucks with existing import rows (always show every dispatched truck). */
export function mergeImportRowsWithDispatch(
  importRows: CrateImportRowShape[],
  dispatchedPlates: string[]
): CrateImportRowShape[] {
  const rowsByPlate = new Map<string, CrateImportRowShape[]>();
  for (const row of importRows) {
    if (!row.truckPlate) continue;
    const list = rowsByPlate.get(row.truckPlate) ?? [];
    list.push(row);
    rowsByPlate.set(row.truckPlate, list);
  }

  const merged: CrateImportRowShape[] = [];
  const seenPlates = new Set<string>();

  for (const plate of dispatchedPlates) {
    seenPlates.add(plate);
    const existing = rowsByPlate.get(plate);
    if (existing && existing.length > 0) {
      merged.push(...existing);
      continue;
    }
    merged.push({
      truckPlate: plate,
      marketCode: "",
      quantities: emptyCrateImportQuantities(),
      notes: "",
      status: "on_the_way",
      noReturn: false,
      awaitingQty: false,
    });
  }

  for (const [plate, plateRows] of Array.from(rowsByPlate.entries())) {
    if (seenPlates.has(plate)) continue;
    merged.push(...plateRows);
  }

  return merged;
}

export function shouldPersistCrateImportRow(row: CrateImportRowShape) {
  if (!row.truckPlate?.trim()) return false;
  if (row.marketCode?.trim()) return true;
  return Boolean(row.noReturn);
}

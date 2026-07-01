"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWrite } from "@/lib/require-auth";
import { formatDisplayDate } from "@/lib/date-utils";
import { parseDateInput, toDateInputValue } from "@/lib/inbound-utils";
import {
  CRATE_IMPORT_OTHER_COLUMN,
  isDefaultImportColumn,
  TONG_IMPORT_DEFAULT_COLUMNS,
} from "@/lib/constants/tong-import-columns";
import { CRATE_IMPORT_TONG_TYPE_WHERE } from "@/lib/constants/tong-type-scope";
import {
  CRATE_IMPORT_NO_RETURN_NOTE,
  CRATE_IMPORT_PENDING_QTY_NOTE,
  emptyCrateImportQuantities,
  mergeImportRowsWithDispatch,
  parseCrateImportRowKey,
  rowHasPositiveCrateQty,
  shouldPersistCrateImportRow,
} from "@/lib/crate-import-rows";
import { ensureCrateReturnMonthlyInvoicesForCrateTypes } from "@/lib/crate-return-billing";
import { syncPayrollTripsAfterCrateImportChange } from "@/lib/driver-payroll-trip-sync";
import {
  appendCrateChangeLogs,
  buildCrateReturnArrivedAuditLog,
} from "@/lib/crate-audit";
import { t } from "@/lib/i18n/translate";
import type { UserLanguage } from "@/types";

export interface CrateTypeOption {
  id: string;
  code: string;
  name: string;
}

export async function getCrateTypesForImport(): Promise<CrateTypeOption[]> {
  const defaultCodes = TONG_IMPORT_DEFAULT_COLUMNS.map((c) => c.tongCode);
  return prisma.tongType.findMany({
    where: {
      ...CRATE_IMPORT_TONG_TYPE_WHERE,
      code: { notIn: [...defaultCodes, CRATE_IMPORT_OTHER_COLUMN] },
    },
    orderBy: { displayOrder: "asc" },
    select: { id: true, code: true, name: true },
  });
}

export interface CrateImportRowInput {
  truckPlate: string;
  marketCode: string;
  quantities: Record<string, string>;
  notes?: string;
  status?: "on_the_way" | "arrived";
  noReturn?: boolean;
}

export interface CrateImportLoadedRow {
  truckPlate: string;
  marketCode: string;
  quantities: Record<string, string>;
  notes: string;
  status: "on_the_way" | "arrived";
  noReturn?: boolean;
  awaitingQty?: boolean;
}

export interface InTransitImportRow extends CrateImportLoadedRow {
  dateInput: string;
  dateStr: string;
}

export interface SaveCrateImportResult {
  savedCount: number;
  skippedCount: number;
}

type TongImportRecord = {
  date: Date;
  quantity: number;
  status: string;
  notes: string | null;
  otherCols: Prisma.JsonValue | null;
  truck: { plate: string };
  market: { code: string };
  tongType: { code: string };
};

function parseOtherColsJson(
  value: Prisma.JsonValue | null
): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, qty] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof qty === "number" ? qty : parseInt(String(qty), 10);
    if (!Number.isNaN(n) && n > 0) result[key] = n;
  }
  return result;
}

export async function getDispatchedTrucksForImportDate(dateStr: string) {
  const date = parseDateInput(dateStr);
  const orders = await prisma.dispatchOrder.findMany({
    where: {
      date,
      status: { notIn: ["draft", "cancelled"] },
    },
    include: { truck: { select: { plate: true } } },
    orderBy: { createdAt: "asc" },
  });

  const plates: string[] = [];
  const seen = new Set<string>();

  for (const order of orders) {
    const plate = order.truck.plate;
    if (seen.has(plate)) continue;
    seen.add(plate);
    plates.push(plate);
  }

  return { plates };
}

export async function getDispatchedTruckPlatesForDate(
  dateStr: string
): Promise<string[]> {
  const { plates } = await getDispatchedTrucksForImportDate(dateStr);
  return plates;
}

function groupTongImportsToRows(imports: TongImportRecord[]) {
  const rowMap = new Map<string, CrateImportLoadedRow>();
  const dynamicColNames = new Set<string>();

  for (const imp of imports) {
    const key = `${imp.truck.plate}|${imp.market.code}`;
    let row = rowMap.get(key);
    if (!row) {
      row = {
        truckPlate: imp.truck.plate,
        marketCode: imp.market.code,
        quantities: emptyCrateImportQuantities(),
        notes: "",
        status: imp.status as "on_the_way" | "arrived",
        noReturn: false,
        awaitingQty: false,
      };
      rowMap.set(key, row);
    }

    if (
      imp.notes === CRATE_IMPORT_NO_RETURN_NOTE &&
      imp.quantity === 0
    ) {
      row.noReturn = true;
      row.status = imp.status as "on_the_way" | "arrived";
      continue;
    }

    if (
      imp.notes === CRATE_IMPORT_PENDING_QTY_NOTE &&
      imp.quantity === 0
    ) {
      row.awaitingQty = true;
      row.status = imp.status as "on_the_way" | "arrived";
      continue;
    }

    const colKey = imp.tongType.code;
    if (imp.quantity > 0) {
      row.quantities[colKey] = String(imp.quantity);
      if (!isDefaultImportColumn(colKey)) {
        dynamicColNames.add(colKey);
      }
    }

    const otherCols = parseOtherColsJson(imp.otherCols);
    for (const [name, qty] of Object.entries(otherCols)) {
      row.quantities[name] = String(qty);
      dynamicColNames.add(name);
    }

    if (
      imp.notes &&
      imp.notes !== CRATE_IMPORT_NO_RETURN_NOTE &&
      imp.notes !== CRATE_IMPORT_PENDING_QTY_NOTE
    ) {
      row.notes = imp.notes;
    }
  }

  return {
    rows: Array.from(rowMap.values()),
    dynamicColumns: Array.from(dynamicColNames),
  };
}

const tongImportInclude = {
  truck: { select: { plate: true } },
  market: { select: { code: true } },
  tongType: { select: { code: true } },
} as const;

export async function loadCrateImportsForDate(dateStr: string) {
  const date = parseDateInput(dateStr);
  const [imports, dispatch] = await Promise.all([
    prisma.tongImport.findMany({
      where: { date },
      include: tongImportInclude,
      orderBy: { createdAt: "asc" },
    }),
    getDispatchedTrucksForImportDate(dateStr),
  ]);

  const grouped = groupTongImportsToRows(imports);
  const rows = mergeImportRowsWithDispatch(
    grouped.rows,
    dispatch.plates
  ).map((row) => ({
    ...row,
    notes:
      row.notes === CRATE_IMPORT_NO_RETURN_NOTE ||
      row.notes === CRATE_IMPORT_PENDING_QTY_NOTE
        ? ""
        : (row.notes ?? ""),
    status: row.status ?? "on_the_way",
  }));

  return {
    rows,
    dynamicColumns: grouped.dynamicColumns,
    dispatchedPlates: dispatch.plates,
  };
}

export async function loadInTransitCrateImports() {
  const imports = await prisma.tongImport.findMany({
    where: {
      status: "on_the_way",
      OR: [
        { notes: null },
        { notes: { not: CRATE_IMPORT_PENDING_QTY_NOTE } },
      ],
    },
    include: tongImportInclude,
    orderBy: [{ date: "desc" }, { createdAt: "asc" }],
  });

  const byDate = new Map<string, TongImportRecord[]>();
  for (const imp of imports) {
    const dateInput = toDateInputValue(imp.date);
    const list = byDate.get(dateInput) ?? [];
    list.push(imp);
    byDate.set(dateInput, list);
  }

  const rows: InTransitImportRow[] = [];
  const dynamicColNames = new Set<string>();

  for (const [dateInput, dateImports] of Array.from(byDate.entries())) {
    const grouped = groupTongImportsToRows(dateImports);
    for (const col of grouped.dynamicColumns) dynamicColNames.add(col);

    for (const row of grouped.rows) {
      rows.push({
        ...row,
        notes:
          row.notes === CRATE_IMPORT_NO_RETURN_NOTE ? "" : row.notes,
        dateInput,
        dateStr: formatDisplayDate(parseDateInput(dateInput)),
      });
    }
  }

  rows.sort((a, b) => {
    const dateCmp = b.dateInput.localeCompare(a.dateInput);
    if (dateCmp !== 0) return dateCmp;
    return a.truckPlate.localeCompare(b.truckPlate);
  });

  return {
    rows,
    dynamicColumns: Array.from(dynamicColNames),
  };
}

export async function markCrateImportRowArrived(
  dateStr: string,
  truckPlate: string,
  marketCode: string
) {
  const user = await requireWrite();
  const locale = user.language;

  const date = parseDateInput(dateStr);
  const [truck, market] = await Promise.all([
    prisma.truck.findFirst({
      where: { plate: truckPlate },
      select: { id: true },
    }),
    prisma.market.findFirst({
      where: { code: marketCode },
      select: { id: true },
    }),
  ]);
  if (!truck) {
    throw new Error(
      t("crateImport.error.plateNotFound", locale, { plate: truckPlate })
    );
  }
  if (!market) {
    throw new Error(
      t("crateImport.error.invalidMarket", locale, { code: marketCode })
    );
  }

  const pendingImports = await prisma.tongImport.findMany({
    where: {
      date,
      truckId: truck.id,
      marketId: market.id,
      status: "on_the_way",
    },
    include: {
      tongType: { select: { code: true, isBox: true } },
    },
  });

  const lines = pendingImports
    .filter((row) => !row.tongType.isBox && row.quantity > 0)
    .map((row) => ({
      crateTypeCode: row.tongType.code,
      quantity: row.quantity,
    }));

  const auditLog = buildCrateReturnArrivedAuditLog({
    truckPlate,
    marketCode,
    dateStr,
    lines,
  });

  await prisma.$transaction(async (tx) => {
    await tx.tongImport.updateMany({
      where: {
        date,
        truckId: truck.id,
        marketId: market.id,
        status: "on_the_way",
      },
      data: { status: "arrived", arrivedAt: new Date() },
    });

    if (auditLog) {
      await appendCrateChangeLogs(tx, {
        actor: user,
        logs: [auditLog],
      });
    }
  });

  revalidatePath("/tong/import");
  revalidatePath("/crate/import");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");
  revalidatePath("/history");
}

function collectDynamicColumnKeys(rows: CrateImportRowInput[]) {
  const keys = new Set<string>();
  const defaultKeys = new Set<string>(
    TONG_IMPORT_DEFAULT_COLUMNS.map((c) => c.key)
  );
  for (const row of rows) {
    for (const key of Object.keys(row.quantities)) {
      if (!defaultKeys.has(key)) keys.add(key);
    }
  }
  return Array.from(keys);
}

function buildNoReturnRecords(input: {
  row: CrateImportRowInput;
  date: Date;
  userId: string;
  truckId: string;
  marketId: string;
  fallbackTongTypeId: string | undefined;
  otherTongTypeId: string | undefined;
}): Prisma.TongImportCreateManyInput[] {
  const tongTypeId = input.otherTongTypeId ?? input.fallbackTongTypeId;
  if (!tongTypeId) return [];

  const status = input.row.status ?? "arrived";
  return [
    {
      date: input.date,
      truckId: input.truckId,
      marketId: input.marketId,
      tongTypeId,
      quantity: 0,
      notes: CRATE_IMPORT_NO_RETURN_NOTE,
      status,
      arrivedAt: status === "arrived" ? new Date() : null,
      createdById: input.userId,
    },
  ];
}

function buildAwaitingQtyRecords(input: {
  row: CrateImportRowInput;
  date: Date;
  userId: string;
  truckId: string;
  marketId: string;
  fallbackTongTypeId: string | undefined;
  otherTongTypeId: string | undefined;
}): Prisma.TongImportCreateManyInput[] {
  const tongTypeId = input.otherTongTypeId ?? input.fallbackTongTypeId;
  if (!tongTypeId) return [];

  const status = input.row.status ?? "on_the_way";
  return [
    {
      date: input.date,
      truckId: input.truckId,
      marketId: input.marketId,
      tongTypeId,
      quantity: 0,
      notes: CRATE_IMPORT_PENDING_QTY_NOTE,
      status,
      arrivedAt: status === "arrived" ? new Date() : null,
      createdById: input.userId,
    },
  ];
}

function buildQuantityRecordsForRow(
  row: CrateImportRowInput,
  date: Date,
  userId: string,
  truckId: string,
  marketId: string,
  tongMap: Record<string, string>,
  otherTongTypeId: string | undefined
): Prisma.TongImportCreateManyInput[] {
  const otherColsData: Record<string, number> = {};
  const tongEntries: { tongTypeId: string; quantity: number }[] = [];

  for (const [colKey, raw] of Object.entries(row.quantities)) {
    const qty = parseInt(raw ?? "0", 10) || 0;
    if (qty <= 0) continue;

    if (colKey === CRATE_IMPORT_OTHER_COLUMN) {
      otherColsData[colKey] = qty;
      continue;
    }

    const tongTypeId = tongMap[colKey];
    if (tongTypeId) {
      tongEntries.push({ tongTypeId, quantity: qty });
    } else {
      otherColsData[colKey] = qty;
    }
  }

  if (tongEntries.length === 0 && Object.keys(otherColsData).length === 0) {
    return [];
  }

  const hasOtherCols = Object.keys(otherColsData).length > 0;
  let storedOtherCols = false;
  const status = row.status ?? "on_the_way";
  const baseData = {
    date,
    truckId,
    marketId,
    status,
    arrivedAt: status === "arrived" ? new Date() : null,
    notes: row.notes?.trim() || null,
    createdById: userId,
  };

  const records: Prisma.TongImportCreateManyInput[] = [];

  for (const entry of tongEntries) {
    records.push({
      ...baseData,
      tongTypeId: entry.tongTypeId,
      quantity: entry.quantity,
      otherCols:
        !storedOtherCols && hasOtherCols ? otherColsData : undefined,
    });
    storedOtherCols = storedOtherCols || hasOtherCols;
  }

  if (!storedOtherCols && hasOtherCols && otherTongTypeId) {
    records.push({
      ...baseData,
      tongTypeId: otherTongTypeId,
      quantity: 0,
      otherCols: otherColsData,
    });
  }

  return records;
}

function buildRecordsForPersistedRow(
  row: CrateImportRowInput,
  date: Date,
  userId: string,
  truckMap: Record<string, string>,
  marketMap: Record<string, string>,
  tongMap: Record<string, string>,
  otherTongTypeId: string | undefined,
  fallbackTongTypeId: string | undefined,
  dynamicColumnKeys: string[],
  locale: UserLanguage
): {
  truckId: string;
  marketId: string;
  records: Prisma.TongImportCreateManyInput[];
} | null {
  if (!row.truckPlate) return null;
  const truckId = truckMap[row.truckPlate];
  if (!truckId) {
    throw new Error(
      t("crateImport.error.plateNotFound", locale, {
        plate: row.truckPlate,
      })
    );
  }
  if (!row.marketCode) return null;

  const marketId = marketMap[row.marketCode];
  if (!marketId) {
    throw new Error(
      t("crateImport.error.invalidMarket", locale, { code: row.marketCode })
    );
  }

  if (row.noReturn) {
    return {
      truckId,
      marketId,
      records: buildNoReturnRecords({
        row,
        date,
        userId,
        truckId,
        marketId,
        fallbackTongTypeId,
        otherTongTypeId,
      }),
    };
  }

  if (rowHasPositiveCrateQty(row.quantities, dynamicColumnKeys)) {
    return {
      truckId,
      marketId,
      records: buildQuantityRecordsForRow(
        row,
        date,
        userId,
        truckId,
        marketId,
        tongMap,
        otherTongTypeId
      ),
    };
  }

  return {
    truckId,
    marketId,
    records: buildAwaitingQtyRecords({
      row,
      date,
      userId,
      truckId,
      marketId,
      fallbackTongTypeId,
      otherTongTypeId,
    }),
  };
}

export async function saveCrateImport(
  dateStr: string,
  rows: CrateImportRowInput[],
  deletedRowKeys: string[] = []
): Promise<SaveCrateImportResult> {
  const user = await requireWrite();
  const locale = user.language;

  const date = parseDateInput(dateStr);
  const [trucks, markets, tongTypes] = await Promise.all([
    prisma.truck.findMany({ select: { id: true, plate: true } }),
    prisma.market.findMany({ select: { id: true, code: true } }),
    prisma.tongType.findMany({ select: { id: true, code: true } }),
  ]);

  const truckMap = Object.fromEntries(trucks.map((t) => [t.plate, t.id]));
  const marketMap = Object.fromEntries(markets.map((m) => [m.code, m.id]));
  const tongMap = Object.fromEntries(tongTypes.map((t) => [t.code, t.id]));
  const otherTongTypeId = tongMap[CRATE_IMPORT_OTHER_COLUMN];
  const fallbackTongTypeId =
    tongMap[TONG_IMPORT_DEFAULT_COLUMNS[0]?.tongCode ?? "ABB"];
  const dynamicColumnKeys = collectDynamicColumnKeys(rows);

  const persistedRecords: Prisma.TongImportCreateManyInput[] = [];
  const affectedPlates = new Set<string>();
  let savedCount = 0;
  let skippedCount = 0;

  for (const row of rows) {
    if (row.truckPlate.trim()) affectedPlates.add(row.truckPlate.trim());
    if (row.truckPlate.trim() && !row.marketCode.trim()) {
      skippedCount += 1;
    }
  }
  for (const key of deletedRowKeys) {
    const { truckPlate } = parseCrateImportRowKey(key);
    if (truckPlate.trim()) affectedPlates.add(truckPlate.trim());
  }

  await prisma.$transaction(async (tx) => {
    for (const key of deletedRowKeys) {
      const { truckPlate, marketCode } = parseCrateImportRowKey(key);
      if (!truckPlate || !marketCode) continue;
      const truckId = truckMap[truckPlate];
      const marketId = marketMap[marketCode];
      if (!truckId || !marketId) continue;
      await tx.tongImport.deleteMany({
        where: { date, truckId, marketId },
      });
    }

    for (const row of rows) {
      if (!shouldPersistCrateImportRow(row)) continue;

      const built = buildRecordsForPersistedRow(
        row,
        date,
        user.id,
        truckMap,
        marketMap,
        tongMap,
        otherTongTypeId,
        fallbackTongTypeId,
        dynamicColumnKeys,
        locale
      );
      if (!built || built.records.length === 0) continue;

      await tx.tongImport.deleteMany({
        where: {
          date,
          truckId: built.truckId,
          marketId: built.marketId,
        },
      });
      await tx.tongImport.createMany({ data: built.records });
      persistedRecords.push(...built.records);
      savedCount += 1;
    }
  });

  const activeRateTypes = new Set(
    (
      await prisma.crateReturnFreightRate.findMany({
        where: { active: true },
        select: { crateType: true },
      })
    ).map((row) => row.crateType)
  );
  const idToCode = Object.fromEntries(tongTypes.map((t) => [t.id, t.code]));
  const billedCrateTypes = new Set<string>();
  for (const record of persistedRecords) {
    if (record.quantity <= 0) continue;
    const code = idToCode[record.tongTypeId];
    if (code && activeRateTypes.has(code)) {
      billedCrateTypes.add(code);
    }
  }
  if (billedCrateTypes.size > 0) {
    await ensureCrateReturnMonthlyInvoicesForCrateTypes(
      date,
      Array.from(billedCrateTypes)
    );
  }

  await syncPayrollTripsAfterCrateImportChange(date, Array.from(affectedPlates));

  revalidatePath("/tong/import");
  revalidatePath("/crate/import");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");
  revalidatePath("/documents/crate-return-invoice");
  revalidatePath("/driver-payroll");

  return { savedCount, skippedCount };
}

/** Mark in-transit imports as arrived — SADAO stock +quantity per crate type. */
export async function confirmCrateImportArrived(dateStr: string) {
  const user = await requireWrite();

  const date = parseDateInput(dateStr);
  const pendingImports = await prisma.tongImport.findMany({
    where: { date, status: "on_the_way" },
    include: {
      truck: { select: { plate: true } },
      market: { select: { code: true } },
      tongType: { select: { code: true, isBox: true } },
    },
  });

  const grouped = new Map<
    string,
    { truckPlate: string; marketCode: string; lines: Array<{ crateTypeCode: string; quantity: number }> }
  >();
  for (const row of pendingImports) {
    if (row.tongType.isBox || row.quantity <= 0) continue;
    const key = `${row.truck.plate}:${row.market.code}`;
    const bucket = grouped.get(key) ?? {
      truckPlate: row.truck.plate,
      marketCode: row.market.code,
      lines: [],
    };
    bucket.lines.push({
      crateTypeCode: row.tongType.code,
      quantity: row.quantity,
    });
    grouped.set(key, bucket);
  }

  const auditLogs = Array.from(grouped.values())
    .map((group) =>
      buildCrateReturnArrivedAuditLog({
        truckPlate: group.truckPlate,
        marketCode: group.marketCode,
        dateStr,
        lines: group.lines,
      })
    )
    .filter((log): log is NonNullable<typeof log> => log != null);

  await prisma.$transaction(async (tx) => {
    await tx.tongImport.updateMany({
      where: { date, status: "on_the_way" },
      data: { status: "arrived", arrivedAt: new Date() },
    });

    if (auditLogs.length > 0) {
      await appendCrateChangeLogs(tx, {
        actor: user,
        logs: auditLogs,
      });
    }
  });

  revalidatePath("/tong/import");
  revalidatePath("/crate/import");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");
  revalidatePath("/history");
}

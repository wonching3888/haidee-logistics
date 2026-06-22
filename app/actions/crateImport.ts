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
import { ensureCrateReturnMonthlyInvoicesForCrateTypes } from "@/lib/crate-return-billing";
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
}

export interface CrateImportLoadedRow {
  truckPlate: string;
  marketCode: string;
  quantities: Record<string, string>;
  notes: string;
  status: "on_the_way" | "arrived";
}

export interface InTransitImportRow extends CrateImportLoadedRow {
  dateInput: string;
  dateStr: string;
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

function emptyQuantities(): Record<string, string> {
  return Object.fromEntries(
    TONG_IMPORT_DEFAULT_COLUMNS.map((c) => [c.key, ""])
  );
}

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

export async function getDispatchedTruckPlatesForDate(
  dateStr: string
): Promise<string[]> {
  const date = parseDateInput(dateStr);
  const orders = await prisma.dispatchOrder.findMany({
    where: {
      date,
      status: { notIn: ["draft", "cancelled"] },
    },
    include: { truck: { select: { plate: true } } },
    orderBy: { createdAt: "asc" },
  });

  return Array.from(new Set(orders.map((o) => o.truck.plate)));
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
        quantities: emptyQuantities(),
        notes: imp.notes ?? "",
        status: imp.status as "on_the_way" | "arrived",
      };
      rowMap.set(key, row);
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
  const [imports, dispatchedPlates] = await Promise.all([
    prisma.tongImport.findMany({
      where: { date },
      include: tongImportInclude,
      orderBy: { createdAt: "asc" },
    }),
    getDispatchedTruckPlatesForDate(dateStr),
  ]);

  const grouped = groupTongImportsToRows(imports);
  let rows = grouped.rows;

  if (rows.length === 0 && dispatchedPlates.length > 0) {
    rows = dispatchedPlates.map((plate) => ({
      truckPlate: plate,
      marketCode: "",
      quantities: emptyQuantities(),
      notes: "",
      status: "on_the_way" as const,
    }));
  }

  return {
    rows,
    dynamicColumns: grouped.dynamicColumns,
    dispatchedPlates,
  };
}

export async function loadInTransitCrateImports() {
  const imports = await prisma.tongImport.findMany({
    where: { status: "on_the_way" },
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

  await prisma.tongImport.updateMany({
    where: {
      date,
      truckId: truck.id,
      marketId: market.id,
      status: "on_the_way",
    },
    data: { status: "arrived", arrivedAt: new Date() },
  });

  revalidatePath("/tong/import");
  revalidatePath("/crate/import");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");
}

/**
 * Save crate import records. SADAO stock increases when status is "arrived"
 * (computed from tong_imports). Customer crate stock is not affected.
 */
function buildTongImportRecords(
  rows: CrateImportRowInput[],
  date: Date,
  userId: string,
  truckMap: Record<string, string>,
  marketMap: Record<string, string>,
  tongMap: Record<string, string>,
  otherTongTypeId: string | undefined,
  locale: UserLanguage
): Prisma.TongImportCreateManyInput[] {
  const records: Prisma.TongImportCreateManyInput[] = [];

  for (const row of rows) {
    if (!row.truckPlate) continue;
    const truckId = truckMap[row.truckPlate];
    if (!truckId) {
      throw new Error(
        t("crateImport.error.plateNotFound", locale, {
          plate: row.truckPlate,
        })
      );
    }
    if (!row.marketCode) continue;

    const marketId = marketMap[row.marketCode];
    if (!marketId) {
      throw new Error(
        t("crateImport.error.invalidMarket", locale, { code: row.marketCode })
      );
    }

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

    const hasOtherCols = Object.keys(otherColsData).length > 0;
    let storedOtherCols = false;
    const baseData = {
      date,
      truckId,
      marketId,
      status: row.status ?? "on_the_way",
      arrivedAt: row.status === "arrived" ? new Date() : null,
      notes: row.notes || null,
      createdById: userId,
    };

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
  }

  return records;
}

export async function saveCrateImport(
  dateStr: string,
  rows: CrateImportRowInput[]
) {
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
  const otherTongTypeId = tongMap["OTHER"];

  const records = buildTongImportRecords(
    rows,
    date,
    user.id,
    truckMap,
    marketMap,
    tongMap,
    otherTongTypeId,
    locale
  );

  await prisma.$transaction(async (tx) => {
    await tx.tongImport.deleteMany({ where: { date } });
    if (records.length > 0) {
      await tx.tongImport.createMany({ data: records });
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
  for (const record of records) {
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

  revalidatePath("/tong/import");
  revalidatePath("/crate/import");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");
  revalidatePath("/documents/crate-return-invoice");
}

/** Mark in-transit imports as arrived — SADAO stock +quantity per crate type. */
export async function confirmCrateImportArrived(dateStr: string) {
  await requireWrite();

  const date = parseDateInput(dateStr);
  await prisma.tongImport.updateMany({
    where: { date, status: "on_the_way" },
    data: { status: "arrived", arrivedAt: new Date() },
  });

  revalidatePath("/tong/import");
  revalidatePath("/crate/import");
  revalidatePath("/tong/stock");
  revalidatePath("/crate/stock");
}

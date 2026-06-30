import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";
import {
  arDocNoPrefixForCrateReturnDebtor,
  formatArDocNo,
} from "@/lib/ar-invoice-export/ar-invoice-docno";
import { fetchCharterAmountsForMonth } from "@/lib/ar-invoice-export/ar-invoice-charter-fetcher";
import { fetchCrateReturnAmountsForMonth } from "@/lib/ar-invoice-export/ar-invoice-crate-return-fetcher";
import { fetchFreightAmountsForMonth } from "@/lib/ar-invoice-export/ar-invoice-freight-fetcher";
import type { ArInvoiceAmountSource } from "@/lib/ar-invoice-export/ar-invoice-row";

export interface ArDocNoRegistry {
  year: number;
  month: number;
  /** Receivable invoiceKey → DocNo */
  byEntityKey: ReadonlyMap<string, string>;
}

export interface ArDocNoSlot {
  entityKey: string;
  prefix: "HD-" | "HDR-" | "EXP-";
}

const FREIGHT_MODES_BY_PREFIX: Record<
  "HD-" | "HDR-" | "EXP-",
  MonthlyInvoiceMode[]
> = {
  "HD-": ["1a", "1b"],
  "HDR-": ["2"],
  "EXP-": ["3", "4"],
};

function assignPoolDocNos(
  year: number,
  month: number,
  prefix: string,
  entityKeys: string[]
): Map<string, string> {
  const result = new Map<string, string>();
  entityKeys.forEach((key, index) => {
    result.set(key, formatArDocNo(prefix, year, month, index + 1));
  });
  return result;
}

/** Pure registry builder for unit tests and deterministic global ordering. */
export function buildArDocNoRegistryFromSlots(
  year: number,
  month: number,
  slots: ArDocNoSlot[]
): ArDocNoRegistry {
  const byPrefix = new Map<string, string[]>();
  for (const slot of slots) {
    const list = byPrefix.get(slot.prefix) ?? [];
    list.push(slot.entityKey);
    byPrefix.set(slot.prefix, list);
  }

  const byEntityKey = new Map<string, string>();
  for (const [prefix, keys] of Array.from(byPrefix.entries())) {
    for (const [key, docNo] of Array.from(
      assignPoolDocNos(year, month, prefix, keys).entries()
    )) {
      byEntityKey.set(key, docNo);
    }
  }

  return { year, month, byEntityKey };
}

/**
 * Build month-wide DocNo registry with deterministic global ordering per prefix:
 * HD-: mode 1a → 1b
 * HDR-: mode 2 → charter (trip date) → crate return 3002-
 * EXP-: mode 3 → mode 4 → crate return 3000-
 */
export async function buildArDocNoRegistry(
  year: number,
  month: number
): Promise<ArDocNoRegistry> {
  const slots: ArDocNoSlot[] = [];

  for (const mode of FREIGHT_MODES_BY_PREFIX["HD-"]) {
    const sources = await fetchFreightAmountsForMonth(year, month, mode);
    for (const source of sources) {
      slots.push({ entityKey: source.entityKey, prefix: "HD-" });
    }
  }

  for (const mode of FREIGHT_MODES_BY_PREFIX["HDR-"]) {
    const sources = await fetchFreightAmountsForMonth(year, month, mode);
    for (const source of sources) {
      slots.push({ entityKey: source.entityKey, prefix: "HDR-" });
    }
  }

  const charters = await fetchCharterAmountsForMonth(year, month);
  for (const source of charters) {
    slots.push({ entityKey: source.entityKey, prefix: "HDR-" });
  }

  const crateReturns = await fetchCrateReturnAmountsForMonth(year, month);
  for (const source of crateReturns) {
    if (arDocNoPrefixForCrateReturnDebtor(source.debtorCode) === "HDR-") {
      slots.push({ entityKey: source.entityKey, prefix: "HDR-" });
    }
  }

  for (const mode of FREIGHT_MODES_BY_PREFIX["EXP-"]) {
    const sources = await fetchFreightAmountsForMonth(year, month, mode);
    for (const source of sources) {
      slots.push({ entityKey: source.entityKey, prefix: "EXP-" });
    }
  }

  for (const source of crateReturns) {
    if (arDocNoPrefixForCrateReturnDebtor(source.debtorCode) === "EXP-") {
      slots.push({ entityKey: source.entityKey, prefix: "EXP-" });
    }
  }

  return buildArDocNoRegistryFromSlots(year, month, slots);
}

export async function assignDocNosForSources(
  year: number,
  month: number,
  sources: ArInvoiceAmountSource[]
): Promise<Map<string, string>> {
  const registry = await buildArDocNoRegistry(year, month);
  const result = new Map<string, string>();
  for (const source of sources) {
    const docNo = registry.byEntityKey.get(source.entityKey);
    if (!docNo) {
      throw new Error(`Missing DocNo for entity ${source.entityKey}`);
    }
    result.set(source.entityKey, docNo);
  }
  return result;
}

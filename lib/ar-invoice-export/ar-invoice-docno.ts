import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";

/** Doc-no modes — charter shares HDR- with mode 2; mode 4 shares EXP- with mode 3. */
export type ArInvoiceDocNoMode = MonthlyInvoiceMode | "charter";

export function arDocNoMonthToken(year: number, month: number): string {
  const yy = String(year % 100).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${yy}${mm}`;
}

export function arDocNoPrefixForMode(mode: ArInvoiceDocNoMode): string {
  switch (mode) {
    case "1a":
    case "1b":
      return "HD-";
    case "2":
    case "charter":
      return "HDR-";
    case "3":
    case "4":
      return "EXP-";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/**
 * Format AR invoice DocNo: `{prefix}{yyMM}-{NNN}` e.g. HD-2606-001.
 * `prefix` must include its trailing hyphen (HD-, HDR-, EXP-, WTL-).
 */
export function formatArDocNo(
  prefix: string,
  year: number,
  month: number,
  sequence: number
): string {
  const token = arDocNoMonthToken(year, month);
  const nnn = String(sequence).padStart(3, "0");
  return `${prefix}${token}-${nnn}`;
}

function allocatorKey(prefix: string, year: number, month: number): string {
  return `${prefix}|${arDocNoMonthToken(year, month)}`;
}

/**
 * Sequential DocNo allocator for a calendar month.
 * Same prefix + month shares one counter:
 * HD- (1a+1b), HDR- (2+charter), EXP- (3+4).
 */
export class ArDocNoSequenceAllocator {
  private readonly counters = new Map<string, number>();

  constructor(
    private readonly year: number,
    private readonly month: number
  ) {}

  /** Next sequence number for a prefix pool (does not format DocNo). */
  nextSequence(prefix: string): number {
    const key = allocatorKey(prefix, this.year, this.month);
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }

  /** Allocate the next DocNo in a prefix pool. */
  allocate(prefix: string): string {
    return formatArDocNo(prefix, this.year, this.month, this.nextSequence(prefix));
  }

  /**
   * Assign DocNos to debtors sorted by code ascending (stable, reproducible).
   * Each debtor receives one number; returns code → DocNo map.
   */
  allocateForDebtors(prefix: string, debtorCodes: string[]): Map<string, string> {
    const sorted = [...debtorCodes].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    const result = new Map<string, string>();
    for (const code of sorted) {
      result.set(code, this.allocate(prefix));
    }
    return result;
  }

  /** Current sequence counter for a prefix pool (0 if none issued yet). */
  currentSequence(prefix: string): number {
    return this.counters.get(allocatorKey(prefix, this.year, this.month)) ?? 0;
  }
}

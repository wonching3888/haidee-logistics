export type DataFreshnessScope =
  | "inbound"
  | "daily-ops"
  | "customer-crate-stock"
  | "monthly-invoice";

export interface InboundFingerprint {
  sessionCount: number;
  maxSessionCreatedAt: string | null;
  lineCount: number;
  maxLineCreatedAt: string | null;
  maxLineModifiedAt: string | null;
  changeLogCount: number;
  maxChangeLogAt: string | null;
}

export interface DailyOpsFingerprint {
  unassignedLineCount: number;
  maxUnassignedLineCreatedAt: string | null;
  maxUnassignedLineModifiedAt: string | null;
  dispatchOrderCount: number;
  maxDispatchOrderCreatedAt: string | null;
  maxDispatchOrderModifiedAt: string | null;
  dispatchLineCount: number;
  maxDispatchLineCreatedAt: string | null;
}

export interface CustomerCrateStockFingerprint {
  stockRowCount: number;
  stockQuantitySum: number;
  maxStockUpdatedAt: string | null;
  ledgerCount: number;
  maxLedgerCreatedAt: string | null;
}

export interface MonthlyInvoiceFingerprint {
  lineCount: number;
  maxLineCreatedAt: string | null;
  maxLineModifiedAt: string | null;
  dualLineCount: number;
  maxDualLineCreatedAt: string | null;
  maxDualLineModifiedAt: string | null;
  extraChargeCount: number;
  maxExtraChargeUpdatedAt: string | null;
}

export type DataFreshnessFingerprint =
  | InboundFingerprint
  | DailyOpsFingerprint
  | CustomerCrateStockFingerprint
  | MonthlyInvoiceFingerprint;

export interface DataFreshnessResponse {
  fingerprint: DataFreshnessFingerprint;
  serverTime: string;
}

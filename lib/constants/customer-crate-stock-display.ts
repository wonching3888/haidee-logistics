/** Customer-owned crate types hidden on /crate/customer-stock (display only; DB unchanged). */
export const HIDDEN_CUSTOMER_CRATE_STOCK_TONG_TYPES = [
  "GKS",
  "GLY",
  "BS",
  "SHS",
] as const;

export type HiddenCustomerCrateStockTongType =
  (typeof HIDDEN_CUSTOMER_CRATE_STOCK_TONG_TYPES)[number];

const HIDDEN_CUSTOMER_CRATE_STOCK_TONG_TYPE_SET = new Set<string>(
  HIDDEN_CUSTOMER_CRATE_STOCK_TONG_TYPES
);

/** Filter crate-type columns for customer crate stock list UI only. */
export function filterCrateTypesForCustomerStockDisplay<T extends { code: string }>(
  crateTypes: T[]
): T[] {
  return crateTypes.filter(
    (crateType) => !HIDDEN_CUSTOMER_CRATE_STOCK_TONG_TYPE_SET.has(crateType.code)
  );
}

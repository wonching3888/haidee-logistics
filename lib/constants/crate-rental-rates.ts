/** Fixed display order for crate rental rate settings. */
export const CRATE_RENTAL_TYPE_ORDER = [
  "ABB",
  "WTL",
  "BHR",
  "VIO",
  "SHK",
  "GKS",
  "BH",
  "MAR",
  "LL_BHR",
  "BRO",
  "GLY",
  "BS",
  "SHS",
  "BOX",
  "OTHER",
] as const;

export type CrateRentalTypeCode = (typeof CRATE_RENTAL_TYPE_ORDER)[number];

export interface CrateRentalRateSeed {
  crateType: CrateRentalTypeCode;
  isRental: boolean;
  rateMyr: number;
  notes: string | null;
}

export const DEFAULT_CRATE_RENTAL_RATES: CrateRentalRateSeed[] = [
  { crateType: "ABB", isRental: true, rateMyr: 10.5, notes: null },
  { crateType: "WTL", isRental: true, rateMyr: 8.0, notes: null },
  { crateType: "BHR", isRental: true, rateMyr: 10.5, notes: null },
  { crateType: "VIO", isRental: true, rateMyr: 11.0, notes: null },
  { crateType: "SHK", isRental: true, rateMyr: 0.0, notes: "待确认" },
  { crateType: "BRO", isRental: true, rateMyr: 0.0, notes: "待确认" },
  { crateType: "GLY", isRental: false, rateMyr: 0.0, notes: "顾客自有" },
  { crateType: "BS", isRental: false, rateMyr: 0.0, notes: "顾客自有" },
  { crateType: "SHS", isRental: false, rateMyr: 0.0, notes: "顾客自有" },
  { crateType: "BOX", isRental: false, rateMyr: 0.0, notes: "顾客自有" },
];

export function sortCrateRentalRates<T extends { crateType: string }>(rows: T[]) {
  const order = new Map(
    CRATE_RENTAL_TYPE_ORDER.map((code, index) => [code, index])
  );
  return [...rows].sort(
    (a, b) =>
      (order.get(a.crateType as CrateRentalTypeCode) ?? 999) -
      (order.get(b.crateType as CrateRentalTypeCode) ?? 999)
  );
}

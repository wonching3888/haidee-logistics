export type TruckCountry = "MY" | "TH";

export const TRUCK_COUNTRIES: {
  value: TruckCountry;
  label: string;
  labelEn: string;
  currency: "MYR" | "THB";
}[] = [
  {
    value: "MY",
    label: "马来西亚",
    labelEn: "Malaysia",
    currency: "MYR",
  },
  {
    value: "TH",
    label: "泰国",
    labelEn: "Thailand",
    currency: "THB",
  },
];

export const DEFAULT_MY_TRUCK_COST_ITEMS = [
  "6411 Upkeep of Lorry",
  "6412 Upkeep of Tyre",
  "6413 Spare Part",
  "6414 New Tyre",
  "6416 Air Cond Service",
  "6400 Insurance",
  "6401 Road Tax",
  "6402 Inspection",
  "6403 Permit",
] as const;

export const DEFAULT_TH_TRUCK_COST_ITEMS = ["维修保养", "保险/路税"] as const;

export const DEFAULT_FUEL_PRICES = {
  myrPerLiter: 2.05,
  thbPerLiter: 35,
} as const;

export function isTruckCountry(value: string | null | undefined): value is TruckCountry {
  return value === "MY" || value === "TH";
}

export function getTruckCountryMeta(country: TruckCountry) {
  return TRUCK_COUNTRIES.find((item) => item.value === country)!;
}

export function defaultCostItemsForCountry(country: TruckCountry) {
  const names =
    country === "MY"
      ? DEFAULT_MY_TRUCK_COST_ITEMS
      : DEFAULT_TH_TRUCK_COST_ITEMS;
  return names.map((name, index) => ({
    name,
    annualAmount: 0,
    sortOrder: index,
  }));
}

export function fuelPriceForCountry(
  country: TruckCountry,
  fuelPrice: { myrPerLiter: number; thbPerLiter: number }
) {
  return country === "MY" ? fuelPrice.myrPerLiter : fuelPrice.thbPerLiter;
}

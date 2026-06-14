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

/** Fixed truck cost item names (all countries). */
export const FIXED_TRUCK_COST_ITEM_NAMES = [
  "维修 Maintenance",
  "Insurance",
  "Road Tax",
  "Inspection",
] as const;

export type FixedTruckCostItemName = (typeof FIXED_TRUCK_COST_ITEM_NAMES)[number];

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
  void country;
  return FIXED_TRUCK_COST_ITEM_NAMES.map((name, index) => ({
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

export type TruckCostItemBucket =
  | "maintenance"
  | "insurance"
  | "roadTax"
  | "inspection"
  | "drop";

export function classifyTruckCostItem(name: string): TruckCostItemBucket {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed === "维修 Maintenance") return "maintenance";
  if (trimmed === "Insurance") return "insurance";
  if (trimmed === "Road Tax") return "roadTax";
  if (trimmed === "Inspection") return "inspection";

  if (lower.includes("permit") || lower.includes("6403")) return "drop";

  if (
    lower.includes("insurance") ||
    lower.includes("6400") ||
    (lower.includes("保险") && !lower.includes("路税"))
  ) {
    return "insurance";
  }

  if (
    lower.includes("road tax") ||
    lower.includes("6401") ||
    (lower.includes("路税") && !lower.includes("保险"))
  ) {
    return "roadTax";
  }

  if (lower.includes("inspection") || lower.includes("6402")) {
    return "inspection";
  }

  if (
    lower.includes("6411") ||
    lower.includes("6412") ||
    lower.includes("6413") ||
    lower.includes("6414") ||
    lower.includes("6416") ||
    lower.includes("upkeep") ||
    lower.includes("tyre") ||
    lower.includes("tire") ||
    lower.includes("spare part") ||
    lower.includes("air cond") ||
    lower.includes("maintenance") ||
    lower.includes("维修") ||
    lower.includes("保养")
  ) {
    return "maintenance";
  }

  if (lower.includes("保险") && lower.includes("路税")) {
    return "insurance";
  }

  return "drop";
}

const BUCKET_TO_FIXED_NAME: Record<
  Exclude<TruckCostItemBucket, "drop">,
  FixedTruckCostItemName
> = {
  maintenance: "维修 Maintenance",
  insurance: "Insurance",
  roadTax: "Road Tax",
  inspection: "Inspection",
};

export function consolidateTruckCostItems(
  items: { name: string; annualAmount: number }[]
) {
  const totals = {
    maintenance: 0,
    insurance: 0,
    roadTax: 0,
    inspection: 0,
  };

  for (const item of items) {
    const bucket = classifyTruckCostItem(item.name);
    if (bucket === "drop") continue;
    totals[bucket] += Number.isFinite(item.annualAmount) ? item.annualAmount : 0;
  }

  return FIXED_TRUCK_COST_ITEM_NAMES.map((name, index) => {
    const bucket = Object.entries(BUCKET_TO_FIXED_NAME).find(
      ([, fixedName]) => fixedName === name
    )?.[0] as Exclude<TruckCostItemBucket, "drop"> | undefined;

    return {
      name,
      annualAmount: bucket ? totals[bucket] : 0,
      sortOrder: index,
    };
  });
}

export function normalizeTruckCostItems(
  items: { name: string; annualAmount: number }[]
) {
  if (items.length === 0) {
    return defaultCostItemsForCountry("MY");
  }

  const alreadyFixed =
    items.length === FIXED_TRUCK_COST_ITEM_NAMES.length &&
    FIXED_TRUCK_COST_ITEM_NAMES.every((name) =>
      items.some((item) => item.name.trim() === name)
    );

  if (alreadyFixed) {
    return FIXED_TRUCK_COST_ITEM_NAMES.map((name, index) => {
      const match = items.find((item) => item.name.trim() === name);
      return {
        name,
        annualAmount: match?.annualAmount ?? 0,
        sortOrder: index,
      };
    });
  }

  return consolidateTruckCostItems(items);
}

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

export function isFixedTruckCostItemName(
  name: string
): name is FixedTruckCostItemName {
  return (FIXED_TRUCK_COST_ITEM_NAMES as readonly string[]).includes(name.trim());
}

export function splitTruckCostItems(
  items: { name: string; annualAmount: number; sortOrder?: number }[]
) {
  const fixedAmounts = new Map<FixedTruckCostItemName, number>();
  for (const name of FIXED_TRUCK_COST_ITEM_NAMES) {
    fixedAmounts.set(name, 0);
  }

  for (const item of items) {
    const trimmed = item.name.trim();
    if (!isFixedTruckCostItemName(trimmed)) continue;
    fixedAmounts.set(
      trimmed,
      (fixedAmounts.get(trimmed) ?? 0) +
        (Number.isFinite(item.annualAmount) ? item.annualAmount : 0)
    );
  }

  const fixed = FIXED_TRUCK_COST_ITEM_NAMES.map((name, index) => ({
    name,
    annualAmount: fixedAmounts.get(name) ?? 0,
    sortOrder: index,
  }));

  const custom = items
    .filter((item) => !isFixedTruckCostItemName(item.name))
    .filter((item) => item.name.trim())
    .map((item, index) => ({
      name: item.name.trim(),
      annualAmount: Number.isFinite(item.annualAmount) ? item.annualAmount : 0,
      sortOrder: FIXED_TRUCK_COST_ITEM_NAMES.length + index,
    }));

  return { fixed, custom, all: [...fixed, ...custom] };
}

/** Load cost items: ensure fixed 4 (missing → 0) and preserve custom rows. */
export function loadTruckCostItems(
  items: { name: string; annualAmount: number }[]
) {
  if (items.length === 0) {
    return defaultCostItemsForCountry("MY");
  }

  const hasFixed = items.some((item) => isFixedTruckCostItemName(item.name));
  const source = hasFixed ? items : consolidateTruckCostItems(items);
  return splitTruckCostItems(source).all;
}

/** Prepare cost items for DB save: fixed 4 + valid custom rows. */
export function prepareTruckCostItemsForSave(
  items: { name: string; annualAmount: number }[]
) {
  if (items.length === 0) {
    return defaultCostItemsForCountry("MY");
  }

  const hasFixed = items.some((item) => isFixedTruckCostItemName(item.name));
  const source = hasFixed ? items : consolidateTruckCostItems(items);
  const { fixed, custom } = splitTruckCostItems(source);

  return [
    ...fixed,
    ...custom.map((item, index) => ({
      ...item,
      sortOrder: FIXED_TRUCK_COST_ITEM_NAMES.length + index,
    })),
  ];
}

/** @deprecated Use loadTruckCostItems or prepareTruckCostItemsForSave. */
export function normalizeTruckCostItems(
  items: { name: string; annualAmount: number }[]
) {
  return loadTruckCostItems(items);
}

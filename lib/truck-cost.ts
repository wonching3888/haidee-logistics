export function roundTruckMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function calcCostPerKm(
  annualAmount: number,
  annualMileageKm: number | null | undefined
) {
  if (!annualMileageKm || annualMileageKm <= 0) return null;
  if (!Number.isFinite(annualAmount)) return null;
  return roundTruckMoney(annualAmount / annualMileageKm);
}

export function calcTotalCostPerKm(
  items: { annualAmount: number }[],
  annualMileageKm: number | null | undefined
) {
  if (!annualMileageKm || annualMileageKm <= 0) return null;
  const totalAnnual = items.reduce(
    (sum, item) => sum + (Number.isFinite(item.annualAmount) ? item.annualAmount : 0),
    0
  );
  return calcCostPerKm(totalAnnual, annualMileageKm);
}

/** Diesel/km + sum of all cost item /km values. */
export function calcGrandTotalPerKm(
  items: { annualAmount: number }[],
  annualMileageKm: number | null | undefined,
  fuelCostPerKm: number | null | undefined
) {
  const itemsPerKm = calcTotalCostPerKm(items, annualMileageKm);
  if (itemsPerKm == null && fuelCostPerKm == null) return null;
  return roundTruckMoney((itemsPerKm ?? 0) + (fuelCostPerKm ?? 0));
}

export function calcFuelCostPerKm(
  fuelPricePerLiter: number | null | undefined,
  fuelEfficiencyKmPerL: number | null | undefined
) {
  if (!fuelPricePerLiter || fuelPricePerLiter <= 0) return null;
  if (!fuelEfficiencyKmPerL || fuelEfficiencyKmPerL <= 0) return null;
  return roundTruckMoney(fuelPricePerLiter / fuelEfficiencyKmPerL);
}

export function formatTruckMoney(value: number | null | undefined, currency: string) {
  if (value == null) return "—";
  return `${value.toFixed(4)} ${currency}/km`;
}

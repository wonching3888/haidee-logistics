import {
  buildCrateRentalMyrRateMap,
  computeCrateRentalLineCostMyr,
} from "@/lib/crate-rental-cost";
import type { CrateRentalRateRow } from "@/lib/crate-rental-rates-service";
import { loadGlobalTripCostValues } from "@/lib/operations-cost";
import { listGlobalCostSettings } from "@/lib/global-cost-settings-service";
import {
  calcFuelCostPerKm,
  calcGrandTotalPerKm,
} from "@/lib/truck-cost";
import { prisma } from "@/lib/prisma";
import { loadExchangeRate } from "@/lib/exchange-rate";
import { decimalToNumber } from "@/lib/freight-rates";

const DEFAULT_LKIM_RATE_CRATE = 2.5;
const DEFAULT_LKIM_RATE_BOX = 1.0;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface CharterSeafoodLineCostInput {
  tongTypeCode: string;
  isBox: boolean;
  quantity: number;
}

export interface CharterCostPreviewInput {
  cargoType: "seafood" | "general";
  includeBorderFees: boolean;
  mileageKm: number;
  truckId: string;
  lines: CharterSeafoodLineCostInput[];
}

export interface CharterCostPreview {
  lkimMyr: number;
  crateRentalMyr: number;
  borderFeesMyr: number;
  vehicleCostMyr: number;
  vehicleCostPerKm: number | null;
  lkimRatePerCrate: number;
  lkimRatePerBox: number;
}

export async function loadLkimRates() {
  const rows = await listGlobalCostSettings();
  return {
    crate:
      rows.find((row) => row.key === "lkim_maqis_per_crate")?.valueMyr ??
      DEFAULT_LKIM_RATE_CRATE,
    box:
      rows.find((row) => row.key === "lkim_maqis_per_box")?.valueMyr ??
      DEFAULT_LKIM_RATE_BOX,
  };
}

export function computeCharterLkimMyr(
  lines: CharterSeafoodLineCostInput[],
  lkimRatePerCrate: number,
  lkimRatePerBox: number
): number {
  let total = 0;
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const rate = line.isBox ? lkimRatePerBox : lkimRatePerCrate;
    total += line.quantity * rate;
  }
  return roundMoney(total);
}

export function computeCharterCrateRentalMyr(
  lines: CharterSeafoodLineCostInput[],
  rentalRateByType: Map<string, number>
): number {
  let total = 0;
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const rate = rentalRateByType.get(line.tongTypeCode) ?? 0;
    total += computeCrateRentalLineCostMyr(line.quantity, rate);
  }
  return roundMoney(total);
}

export type CharterGlobalBorderCosts = {
  borderPass: number;
  epermit: number;
  dagangNet: number;
  forwardingOutbound: number;
};

/** Border pass portion only (Chop/Border voucher actual replaces this when eligible). */
export function computeCharterBorderPassMyr(
  includeBorderFees: boolean,
  globalCosts: Pick<CharterGlobalBorderCosts, "borderPass">
): number {
  if (!includeBorderFees) return 0;
  return roundMoney(globalCosts.borderPass);
}

/** epermit + dagang + forwarding — never overridden by voucher actuals. */
export function computeCharterBorderFeesExceptPassMyr(
  includeBorderFees: boolean,
  globalCosts: Pick<
    CharterGlobalBorderCosts,
    "epermit" | "dagangNet" | "forwardingOutbound"
  >
): number {
  if (!includeBorderFees) return 0;
  return roundMoney(
    globalCosts.epermit +
      globalCosts.dagangNet +
      globalCosts.forwardingOutbound
  );
}

export function computeCharterBorderFeesMyr(
  includeBorderFees: boolean,
  globalCosts: CharterGlobalBorderCosts
): number {
  return roundMoney(
    computeCharterBorderPassMyr(includeBorderFees, globalCosts) +
      computeCharterBorderFeesExceptPassMyr(includeBorderFees, globalCosts)
  );
}

export function computeCharterVehicleCostMyr(
  mileageKm: number,
  costPerKm: number | null
): number {
  if (!costPerKm || mileageKm <= 0) return 0;
  return roundMoney(mileageKm * costPerKm);
}

export async function resolveTruckCostPerKm(truckId: string) {
  const [truck, globalCosts] = await Promise.all([
    prisma.truck.findUnique({
      where: { id: truckId },
      select: {
        fuelEfficiencyKmPerL: true,
        annualMileageKm: true,
        costItems: { select: { annualAmount: true } },
      },
    }),
    loadGlobalTripCostValues(),
  ]);

  if (!truck) return null;

  const fuelCostPerKm = calcFuelCostPerKm(
    globalCosts.fuelPriceMyr,
    decimalToNumber(truck.fuelEfficiencyKmPerL)
  );

  return calcGrandTotalPerKm(
    truck.costItems.map((item) => ({
      annualAmount: decimalToNumber(item.annualAmount) ?? 0,
    })),
    truck.annualMileageKm,
    fuelCostPerKm
  );
}

export async function computeCharterStoredCosts(input: {
  cargoType: "seafood" | "general";
  lines: Array<{ tongTypeCode: string; isBox: boolean; quantity: number }>;
  exchangeRate: number;
  crateRentalRates: CrateRentalRateRow[];
}) {
  if (input.cargoType !== "seafood" || input.lines.length === 0) {
    return { lkimMyr: null, crateRentalMyr: null };
  }

  const lkimRates = await loadLkimRates();
  const rentalRateByType = buildCrateRentalMyrRateMap(
    input.crateRentalRates,
    input.exchangeRate
  );

  return {
    lkimMyr: computeCharterLkimMyr(
      input.lines,
      lkimRates.crate,
      lkimRates.box
    ),
    crateRentalMyr: computeCharterCrateRentalMyr(
      input.lines,
      rentalRateByType
    ),
  };
}

export async function buildCharterCostPreview(
  input: CharterCostPreviewInput & { date: string }
): Promise<CharterCostPreview> {
  const [year, month] = input.date.split("-").map(Number);
  const [lkimRates, globalCosts, costPerKm, exchangeRate] = await Promise.all([
    loadLkimRates(),
    loadGlobalTripCostValues(),
    resolveTruckCostPerKm(input.truckId),
    loadExchangeRate(year, month),
  ]);

  let lkimMyr = 0;
  let crateRentalMyr = 0;

  if (input.cargoType === "seafood" && input.lines.length > 0) {
    const { listCrateRentalRates } = await import(
      "@/lib/crate-rental-rates-service"
    );
    const crateRentalRates = await listCrateRentalRates();
    const rentalRateByType = buildCrateRentalMyrRateMap(
      crateRentalRates,
      exchangeRate
    );
    lkimMyr = computeCharterLkimMyr(
      input.lines,
      lkimRates.crate,
      lkimRates.box
    );
    crateRentalMyr = computeCharterCrateRentalMyr(
      input.lines,
      rentalRateByType
    );
  }

  const borderFeesMyr = computeCharterBorderFeesMyr(
    input.includeBorderFees,
    globalCosts
  );
  const vehicleCostMyr = computeCharterVehicleCostMyr(
    input.mileageKm,
    costPerKm
  );

  return {
    lkimMyr,
    crateRentalMyr,
    borderFeesMyr,
    vehicleCostMyr,
    vehicleCostPerKm: costPerKm,
    lkimRatePerCrate: lkimRates.crate,
    lkimRatePerBox: lkimRates.box,
  };
}

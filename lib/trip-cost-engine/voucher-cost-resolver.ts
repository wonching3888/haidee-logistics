import {
  effectiveKpbFee,
  effectiveUnloadFee,
} from "@/lib/unloading-calculator";
import type { CrateLoadingFeeCostRow } from "@/lib/unloading-trip-cost";
import type { UnloadingFeeCostRow } from "@/lib/unloading-trip-cost";
import type { VoucherCostContext } from "@/lib/trip-cost-engine/types";

export type VoucherCostSourceTag = "actual" | "estimate" | "override";

export interface VoucherRouteCostEstimate {
  borderPassMyr: number;
  parkingMyr: number;
  fishCheckingMyr: number;
}

export interface VoucherTripCostSources {
  chopBorder: VoucherCostSourceTag;
  parking: VoucherCostSourceTag;
  fishCheck: VoucherCostSourceTag;
  kpb: VoucherCostSourceTag;
  upahTurun: VoucherCostSourceTag;
  loading: VoucherCostSourceTag;
  loadUnload: VoucherCostSourceTag;
}

export interface ResolvedVoucherTripCosts {
  costEligible: boolean;
  chopBorderMyr: number;
  parkingMyr: number;
  fishCheckMyr: number;
  kpbMyr: number;
  upahTurunMyr: number;
  loadingMyr: number;
  loadUnloadMyr: number;
  sources: VoucherTripCostSources;
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function sumKpbEstimate(rows: UnloadingFeeCostRow[]) {
  return roundMoney(
    rows.reduce((sum, row) => sum + (row.isKpbExempt ? 0 : row.kpbFee), 0)
  );
}

function sumUnloadEstimate(rows: UnloadingFeeCostRow[]) {
  return roundMoney(rows.reduce((sum, row) => sum + row.unloadFee, 0));
}

function sumKpbEffective(rows: UnloadingFeeCostRow[]) {
  return roundMoney(
    rows.reduce((sum, row) => sum + effectiveKpbFee(row), 0)
  );
}

function sumUnloadEffective(rows: UnloadingFeeCostRow[]) {
  return roundMoney(
    rows.reduce((sum, row) => sum + effectiveUnloadFee(row), 0)
  );
}

function sumLoadingEstimate(rows: CrateLoadingFeeCostRow[]) {
  return roundMoney(rows.reduce((sum, row) => sum + row.loadingFee, 0));
}

function sumLoadingEffective(rows: CrateLoadingFeeCostRow[]) {
  return roundMoney(
    rows.reduce((sum, row) => sum + (row.loadingFeeOverride ?? row.loadingFee), 0)
  );
}

function hasKpbOverride(rows: UnloadingFeeCostRow[]) {
  return rows.some((row) => !row.isKpbExempt && row.kpbFeeOverride != null);
}

function hasUnloadOverride(rows: UnloadingFeeCostRow[]) {
  return rows.some((row) => row.unloadFeeOverride != null);
}

function hasLoadingOverride(rows: CrateLoadingFeeCostRow[]) {
  return rows.some((row) => row.loadingFeeOverride != null);
}

function resolveScalarCost(
  actual: number | null | undefined,
  estimate: number,
  eligible: boolean
): { value: number; source: VoucherCostSourceTag } {
  if (eligible && actual != null) {
    return { value: roundMoney(actual), source: "actual" };
  }
  return { value: roundMoney(estimate), source: "estimate" };
}

/** Cost reads real values only when voucher is confirmed/approved and cost was applied. */
export function isCostEligible(
  status: string,
  costAppliedAt: Date | null | undefined
): boolean {
  if (costAppliedAt == null) return false;
  return status === "confirmed" || status === "approved";
}

export function isCostEligibleFromVoucher(
  voucher: Pick<VoucherCostContext, "status" | "costAppliedAt"> | null | undefined
): boolean {
  if (!voucher) return false;
  return isCostEligible(voucher.status, voucher.costAppliedAt);
}

export interface ResolveVoucherTripCostsInput {
  voucher: VoucherCostContext | null | undefined;
  routeEstimate: VoucherRouteCostEstimate;
  unloadingRows: UnloadingFeeCostRow[];
  loadingRows?: CrateLoadingFeeCostRow[];
}

export function resolveVoucherTripCosts(
  input: ResolveVoucherTripCostsInput
): ResolvedVoucherTripCosts {
  const { voucher, routeEstimate, unloadingRows } = input;
  const loadingRows = input.loadingRows ?? [];
  const eligible = isCostEligibleFromVoucher(voucher);

  const chopBorder = resolveScalarCost(
    voucher?.chopBorderActual,
    routeEstimate.borderPassMyr,
    eligible
  );
  const parking = resolveScalarCost(
    voucher?.parkingActual,
    routeEstimate.parkingMyr,
    eligible
  );
  const fishCheck = resolveScalarCost(
    voucher?.fishCheckActual,
    routeEstimate.fishCheckingMyr,
    eligible
  );

  let kpbMyr: number;
  let kpbSource: VoucherCostSourceTag;
  let upahTurunMyr: number;
  let upahTurunSource: VoucherCostSourceTag;
  let loadingMyr: number;
  let loadingSource: VoucherCostSourceTag;

  if (eligible) {
    kpbMyr = sumKpbEffective(unloadingRows);
    kpbSource = hasKpbOverride(unloadingRows) ? "override" : "estimate";
    upahTurunMyr = sumUnloadEffective(unloadingRows);
    upahTurunSource = hasUnloadOverride(unloadingRows) ? "override" : "estimate";
    loadingMyr = sumLoadingEffective(loadingRows);
    loadingSource = hasLoadingOverride(loadingRows) ? "override" : "estimate";
  } else {
    kpbMyr = sumKpbEstimate(unloadingRows);
    kpbSource = "estimate";
    upahTurunMyr = sumUnloadEstimate(unloadingRows);
    upahTurunSource = "estimate";
    loadingMyr = sumLoadingEstimate(loadingRows);
    loadingSource = "estimate";
  }

  const loadUnloadMyr = roundMoney(kpbMyr + upahTurunMyr + loadingMyr);
  const loadUnloadSource: VoucherCostSourceTag = eligible
    ? kpbSource === "override" ||
      upahTurunSource === "override" ||
      loadingSource === "override"
      ? "override"
      : "estimate"
    : "estimate";

  return {
    costEligible: eligible,
    chopBorderMyr: chopBorder.value,
    parkingMyr: parking.value,
    fishCheckMyr: fishCheck.value,
    kpbMyr,
    upahTurunMyr,
    loadingMyr,
    loadUnloadMyr,
    sources: {
      chopBorder: chopBorder.source,
      parking: parking.source,
      fishCheck: fishCheck.source,
      kpb: kpbSource,
      upahTurun: upahTurunSource,
      loading: loadingSource,
      loadUnload: loadUnloadSource,
    },
  };
}

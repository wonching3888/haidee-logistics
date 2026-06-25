export {
  TRIP_COST_MODES,
  getTripCostEngineConfig,
  getVehicleAllocMode,
  getVoucherCostMode,
  isVoucherCostEnforced,
  reloadTripCostEngineConfig,
  shouldWritebackVoucherActualsOnSave,
  type TripCostEngineConfig,
  type TripCostMode,
} from "@/lib/trip-cost-engine/config";

export type {
  LegacyTripVehicleAllocation,
  LineAllocation,
  TripCostEngineModeSnapshot,
  TripCostInput,
  TripCostLineInput,
  TripVehiclePool,
  VoucherCostContext,
} from "@/lib/trip-cost-engine/types";

export {
  legacyAllocateShare,
  legacyAllocateTripVehicleCosts,
  legacyBuildTripAllocatedPool,
  legacyResolveTripRouteCosts,
  legacyResolveTripVehiclePool,
} from "@/lib/trip-cost-engine/legacy-adapter";

export {
  logTripCostShadowDiff,
  logTripCostShadowDiffs,
  type TripCostShadowDiff,
} from "@/lib/trip-cost-engine/shadow-logger";

export {
  buildVehicleLegPlan,
  incrementalTollForLeg,
  isLineEligibleForLeg,
  routeGroupForLineMarket,
  sortRouteGroupsByMileage,
  type BuildVehicleLegPlanInput,
  type RouteGroupCostPoint,
  type VehicleLeg,
  type VehicleLegPlan,
} from "@/lib/trip-cost-engine/vehicle-leg-resolver";

export {
  allocateTripLineCosts,
  assertTripVehicleAllocationConserved,
  sumAllocationsByRouteGroup,
  sumVariableLegAllocationsByRouteGroup,
  type AllocateTripLineCostsInput,
  type TripGlobalFeePool,
  type TripLineCostAllocationResult,
} from "@/lib/trip-cost-engine/line-cost-allocator";

export {
  isCostEligible,
  isCostEligibleFromVoucher,
  resolveVoucherTripCosts,
  type ResolveVoucherTripCostsInput,
  type ResolvedVoucherTripCosts,
  type VoucherCostSourceTag,
  type VoucherRouteCostEstimate,
  type VoucherTripCostSources,
} from "@/lib/trip-cost-engine/voucher-cost-resolver";

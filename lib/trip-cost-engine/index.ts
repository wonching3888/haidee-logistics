export {
  TRIP_COST_MODES,
  getTripCostEngineConfig,
  getVehicleAllocMode,
  getVoucherCostMode,
  isVoucherCostEnforced,
  isVehicleAllocShadow,
  isVehicleAllocEnforced,
  shouldUseLegacyTripCostOutput,
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
  configureShadowLogger,
  resetShadowLoggerBuffer,
  getShadowLoggerBuffer,
  flushShadowLoggerBuffer,
  selectShadowOutput,
  beginShadowSession,
  endShadowSession,
  isShadowSessionActive,
  type TripCostShadowDiff,
  type ShadowLoggerOptions,
} from "@/lib/trip-cost-engine/shadow-logger";

export {
  auditRouteMileageMaster,
  buildVehicleShadowDiffs,
  compareTripVehicleShadow,
  compareVoucherGateShadow,
  EXPECTED_ROUTE_GROUP_MILEAGE_ORDER,
  type CompareTripShadowInput,
  type MileageAuditIssue,
  type TripVehicleShadowCompare,
  type VoucherGateShadowCompare,
} from "@/lib/trip-cost-engine/shadow-compare";

export {
  buildMonthShadowSummary,
  classifyFeaturedRoute,
  formatFeaturedTripMarkdown,
  formatShadowMarkdownReport,
  type MonthShadowSummary,
  type TripShadowSnapshotRow,
} from "@/lib/trip-cost-engine/shadow-snapshot-report";

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

export {
  allocateShipperVehicleCosts,
  allocateShipperVehicleTotalMyr,
  resolveOperationsTripCostSlice,
  resolveTripAllocatedPool,
  sumTripAllocatedWithoutLoadUnload,
  type OperationsTripCostSlice,
  type ResolveTripAllocatedPoolInput,
  type ResolveTripAllocatedPoolResult,
  type TripAllocatedPool,
} from "@/lib/trip-cost-engine/trip-cost-facade";

export const PNL_ROUTE_FILTERS = [
  "ALL",
  "KL",
  "BM",
  "A",
  "MC",
  "KD",
  "JB",
] as const;

export type PnlRouteFilter = (typeof PNL_ROUTE_FILTERS)[number];
export type PnlPeriodMode = "day" | "range" | "month" | "year";
export type PnlCustomerSort = "profit" | "quantity" | "revenue" | "margin";
export type PnlCustomerSortDir = "asc" | "desc";
export type PnlCustomerStatus = "excellent" | "normal" | "caution" | "loss";

export interface PnlShipperRow {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  quantity: number;
  barrelQty: number;
  boxQty: number;
  revenueMyr: number;
  crateRentalMyr: number;
  lkimMaqisMyr: number;
  thaiSegmentMyr: number;
  unloadFeeMyr: number;
  loadingLaborMyr: number;
  mcThirdPartyHaulageMyr: number;
  /** Charter fixed driver salary (payroll charterSalary); embedded in directCostMyr. */
  driverSalaryMyr?: number;
  directCostMyr: number;
  allocatedFuelMyr: number;
  allocatedMaintenanceMyr: number;
  allocatedTollMyr: number;
  allocatedBorderPassMyr: number;
  allocatedEpermitMyr: number;
  allocatedDagangNetMyr: number;
  allocatedForwardingMyr: number;
  allocatedDriverMyr: number;
  allocatedCostMyr: number;
  totalCostMyr: number;
  grossProfitMyr: number;
  marginPct: number;
}

export interface PnlTripVehicleCosts {
  fuelMyr: number;
  maintenanceMyr: number;
  tollMyr: number;
  borderPassMyr: number;
  epermitMyr: number;
  dagangNetMyr: number;
  forwardingMyr: number;
  driverMyr: number;
  totalMyr: number;
}

export type PnlTripSource = "dispatch" | "charter";

export interface PnlTripRow {
  tripSource: PnlTripSource;
  dispatchOrderId: string;
  date: string;
  routeKey: string;
  routeLabel: string;
  routeGroups: string[];
  driverName: string | null;
  truckPlate: string;
  totalQuantity: number;
  totalBarrelQty: number;
  totalBoxQty: number;
  revenueMyr: number;
  directCostMyr: number;
  allocatedCostMyr: number;
  totalCostMyr: number;
  grossProfitMyr: number;
  marginPct: number;
  vehicleCosts: PnlTripVehicleCosts;
  shippers: PnlShipperRow[];
}

export interface PnlTripTotals {
  revenueMyr: number;
  partnerFreightMyr: number;
  crateReturnIncomeMyr: number;
  monthlyInvoiceExtraChargesMyr: number;
  directCostMyr: number;
  allocatedCostMyr: number;
  totalCostMyr: number;
  grossProfitMyr: number;
  marginPct: number;
  tripCount: number;
  totalQuantity: number;
  totalBarrelQty: number;
  totalBoxQty: number;
}

export interface PnlDailyTrendPoint {
  date: string;
  revenueMyr: number;
  costMyr: number;
  profitMyr: number;
}

export interface PnlPeriodSummary {
  mode: PnlPeriodMode;
  periodLabel: string;
  revenueMyr: number;
  costMyr: number;
  grossProfitMyr: number;
  marginPct: number;
  tripCount: number;
  totalQuantity: number;
  totalBarrelQty: number;
  totalBoxQty: number;
  trend: PnlDailyTrendPoint[];
  /** Reference only (month mode): full-month fleet payroll total cost (net + employer). */
  fleetPayrollTotalMyr: number | null;
  /** Reference only: sum of dispatch trip driverMyr already in period gross profit. */
  /** Dispatch vehicleCosts.driverMyr + charter shipper driverSalaryMyr already in trip P&L. */
  pnlTripDriverAllowanceMyr: number | null;
  /** Reference only: fleetPayrollTotalMyr − pnlTripDriverAllowanceMyr. */
  fleetPayrollIncrementalMyr: number | null;
  /** Reference only: payroll tripAllowance + crateCommission + extraAllowance (gross). */
  payrollVariableAllowanceMyr: number | null;
  /** Reference only (month mode): grossProfitMyr − fleetPayrollIncrementalMyr. */
  netProfitAfterFleetPayrollMyr: number | null;
}

export interface PnlCustomerRow {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  totalQuantity: number;
  totalBarrelQty: number;
  totalBoxQty: number;
  revenueMyr: number;
  directCostMyr: number;
  allocatedCostMyr: number;
  totalCostMyr: number;
  grossProfitMyr: number;
  profitPerCrate: number;
  marginPct: number;
  status: PnlCustomerStatus;
}

export interface PnlCustomerSuggestion {
  shipperCode: string;
  shipperName: string;
  grossProfitMyr: number;
  marginPct: number;
  message: string;
}

export interface PnlTripListItem {
  tripId: string;
  tripSource: PnlTripSource;
  date: string;
  route: string;
  routeGroups: string[];
  driver: string | null;
  plate: string;
  totalCrates: number;
  totalBoxes: number;
  revenueMyr: number;
  directCostMyr: number;
  allocatedCostMyr: number;
  totalCostMyr: number;
  grossProfitMyr: number;
  marginPct: number;
}

export interface PnlTripsListData {
  year: number;
  month: number;
  day: string | null;
  drivers: string[];
  trips: PnlTripListItem[];
  totals: PnlTripTotals;
}

export interface PnlCustomerMarketRow {
  marketCode: string;
  quantity: number;
  ratePerCrate: number;
  revenueMyr: number;
  crateRentalMyr: number;
  lkimMaqisMyr: number;
  thaiSegmentMyr: number;
  unloadFeeMyr: number;
  mcThirdPartyHaulageMyr: number;
  allocatedCostMyr: number;
  totalCostMyr: number;
  grossProfitMyr: number;
}

export interface PnlPeriodData {
  year: number;
  month: number;
  periodSummary: PnlPeriodSummary;
}

export interface PnlCustomerData {
  year: number;
  month: number;
  customers: PnlCustomerRow[];
  lossCustomers: PnlCustomerSuggestion[];
}

export interface PnlReportData {
  year: number;
  month: number;
  exchangeRate: number;
  lkimRatePerCrate: number;
  drivers: string[];
  trips: PnlTripRow[];
  tripTotals: PnlTripTotals;
  periodSummary: PnlPeriodSummary;
  customers: PnlCustomerRow[];
  lossCustomers: PnlCustomerSuggestion[];
}

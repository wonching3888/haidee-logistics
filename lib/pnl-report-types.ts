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
export type PnlCustomerSort = "profit" | "quantity" | "revenue";
export type PnlCustomerStatus = "excellent" | "normal" | "caution" | "loss";

export interface PnlShipperRow {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  quantity: number;
  revenueMyr: number;
  crateRentalMyr: number;
  lkimMaqisMyr: number;
  unloadFeeMyr: number;
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

export interface PnlTripRow {
  dispatchOrderId: string;
  date: string;
  routeKey: string;
  routeLabel: string;
  routeGroups: string[];
  driverName: string | null;
  truckPlate: string;
  totalQuantity: number;
  revenueMyr: number;
  directCostMyr: number;
  allocatedCostMyr: number;
  totalCostMyr: number;
  grossProfitMyr: number;
  marginPct: number;
  shippers: PnlShipperRow[];
}

export interface PnlTripTotals {
  revenueMyr: number;
  directCostMyr: number;
  allocatedCostMyr: number;
  totalCostMyr: number;
  grossProfitMyr: number;
  marginPct: number;
  tripCount: number;
  totalQuantity: number;
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
  trend: PnlDailyTrendPoint[];
}

export interface PnlCustomerRow {
  shipperId: string;
  shipperCode: string;
  shipperName: string;
  totalQuantity: number;
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
  date: string;
  route: string;
  routeGroups: string[];
  driver: string | null;
  plate: string;
  totalCrates: number;
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
  unloadFeeMyr: number;
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

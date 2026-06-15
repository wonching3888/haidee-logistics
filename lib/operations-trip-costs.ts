import {
  aggregateOperationsCosts,
  buildRouteKey,
} from "@/lib/operations-cost";

export { buildRouteKey };
export async function aggregateDispatchOperationalCosts(
  year: number,
  month: number
) {
  const totals = await aggregateOperationsCosts(year, month);
  return {
    fuelMyr: totals.fuelMyr,
    maintenanceMyr: totals.maintenanceMyr,
    tollFee: totals.tollFee,
    fishCheckingFee: totals.fishCheckingFee,
    parkingFee: totals.parkingFee,
    borderPass: totals.borderPass,
    epermit: totals.epermit,
    dagangNet: totals.dagangNet,
    forwarding: totals.forwarding,
    crateRental: totals.crateRental,
    loadUnloadFee: totals.loadUnloadFee,
    tripCount: totals.tripCount,
    routeCount: totals.routeCount,
    totalMileageKm: totals.totalMileageKm,
  };
}

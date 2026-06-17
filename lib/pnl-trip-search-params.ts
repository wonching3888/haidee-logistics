/** Resolve trip day filter: explicit override (including "") wins over stored state. */
export function resolveTripSearchDay(
  tripDay: string,
  override?: { tripDay?: string }
): string {
  return override?.tripDay !== undefined ? override.tripDay : tripDay;
}

export function buildPnlTripsApiSearchParams(input: {
  year: number;
  month: number;
  routeFilter: string;
  driverFilter: string;
  tripDay: string;
}): URLSearchParams {
  const params = new URLSearchParams({
    year: String(input.year),
    month: String(input.month),
    routeFilter: input.routeFilter,
    driverFilter: input.driverFilter,
  });
  if (input.tripDay) {
    params.set("day", input.tripDay);
  }
  return params;
}

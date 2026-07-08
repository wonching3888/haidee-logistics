/** Shortage vs original suggested quantity at issue (not live owed). */
export function crateExportLineShortage(
  quantitySuggested: number,
  quantityActual: number
): number {
  return Math.max(0, quantitySuggested - quantityActual);
}

/**
 * Create: use form/live suggested from the client.
 * Edit save: pass liveQuantitySuggested from server-side owed lookup at save time.
 */
export function resolveCrateExportQuantitySuggested(params: {
  formQuantitySuggested: number;
  liveQuantitySuggested?: number;
}): number {
  if (params.liveQuantitySuggested !== undefined) {
    return params.liveQuantitySuggested;
  }
  return params.formQuantitySuggested;
}

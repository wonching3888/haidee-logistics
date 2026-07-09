/** Shortage vs original suggested quantity at issue (not live owed). */
export function crateExportLineShortage(
  quantitySuggested: number,
  quantityActual: number
): number {
  return Math.max(0, quantitySuggested - quantityActual);
}

/**
 * When liveQuantitySuggested is provided (server save for today), use it.
 * Otherwise fall back to the form value (historical dates or UI display).
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

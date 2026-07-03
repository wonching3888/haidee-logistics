/** Shortage vs original suggested quantity at issue (not live owed). */
export function crateExportLineShortage(
  quantitySuggested: number,
  quantityActual: number
): number {
  return Math.max(0, quantitySuggested - quantityActual);
}

/**
 * Create: use form/live suggested. Edit: freeze DB values captured before reverse.
 */
export function resolveCrateExportQuantitySuggested(params: {
  isEdit: boolean;
  tongTypeId: string;
  formQuantitySuggested: number;
  preservedByTongTypeId?: Record<string, number>;
}): number {
  if (params.isEdit) {
    return params.preservedByTongTypeId?.[params.tongTypeId] ?? 0;
  }
  return params.formQuantitySuggested;
}

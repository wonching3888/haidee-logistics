/**
 * Shadow diff logging (Step 5). No-op until shadow mode is wired into P&L.
 */
export interface TripCostShadowDiff {
  tripId: string;
  scope: "voucher" | "vehicle" | "unload";
  field: string;
  legacyMyr: number;
  nextMyr: number;
  deltaMyr: number;
}

export function logTripCostShadowDiff(diff: TripCostShadowDiff): void {
  void diff;
  // Step 5: persist to artifacts/cost-shadow-*.jsonl or structured logger.
}

export function logTripCostShadowDiffs(diffs: TripCostShadowDiff[]): void {
  for (const diff of diffs) {
    logTripCostShadowDiff(diff);
  }
}

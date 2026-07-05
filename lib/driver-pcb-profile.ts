/**
 * PCB profile completeness for driver master data.
 * Married drivers need spouseWorking; single drivers do not.
 */

export function normalizeSpouseWorking(input: {
  maritalStatus: string | null | undefined;
  spouseWorking: boolean | null | undefined;
}): boolean | null {
  if (input.maritalStatus !== "married") return null;
  if (input.spouseWorking === true || input.spouseWorking === false) {
    return input.spouseWorking;
  }
  return null;
}

/** True when PCB category inputs are incomplete and need review. */
export function derivePcbNeedsReview(input: {
  maritalStatus: string | null | undefined;
  spouseWorking: boolean | null | undefined;
}): boolean {
  if (input.maritalStatus === "single") return false;
  if (input.maritalStatus === "married") {
    return normalizeSpouseWorking(input) == null;
  }
  // Unknown / empty marital status — treat as incomplete.
  return true;
}

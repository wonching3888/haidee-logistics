import type { CrateExportPrefillTarget } from "@/lib/crate-export-due-today";
import { isAgentCrateExportPrefill } from "@/lib/crate-export-due-today";

/** Origin from due-today standalone row prefill (multi-origin customer per-location owed). */
export function standalonePrefillOriginLocation(
  prefill: CrateExportPrefillTarget | null | undefined
): string | null {
  if (!prefill || isAgentCrateExportPrefill(prefill)) return null;
  if (prefill.mode !== "standalone") return null;
  const location = prefill.location?.trim() ?? "";
  return location || null;
}

/** Re-apply pending standalone origin once multi-origin config has loaded. */
export function resolveStandalonePrefillOriginAfterConfig(input: {
  pendingOrigin: string | null;
  isMultiOriginCustomer: boolean;
  locations: string[];
}): string | null {
  if (!input.pendingOrigin || !input.isMultiOriginCustomer) return null;
  if (!input.locations.includes(input.pendingOrigin)) return null;
  return input.pendingOrigin;
}

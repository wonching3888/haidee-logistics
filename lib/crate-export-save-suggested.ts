import {
  type CrateQtyByCode,
} from "@/lib/crate-export-due-today";
import { loadCrateExportDayInput } from "@/lib/crate-export-day-context";
import { shouldUseLiveCrateExportOwed } from "@/lib/crate-export-live-owed";
import { resolveSuggestedByCodeFromDayInput } from "@/lib/crate-export-display-suggested";

/** Server-side suggested qty for save (create + edit), matching due-today owed rules. */
export async function resolveCrateExportSaveSuggestedByCode(input: {
  dateInput: string;
  shipperId: string;
  shipper: { code: string; shipperKind: string | null };
  location: string;
  areaNote?: string | null;
}): Promise<CrateQtyByCode> {
  if (!shouldUseLiveCrateExportOwed(input.dateInput)) {
    return {};
  }

  const dayInput = await loadCrateExportDayInput(input.dateInput);
  return resolveSuggestedByCodeFromDayInput(dayInput, {
    shipperId: input.shipperId,
    shipper: input.shipper,
    location: input.location,
    areaNote: input.areaNote,
  });
}

import { revalidatePath } from "next/cache";
import { clearPnlMonthTripsCache } from "@/lib/pnl-month-cache";

/** Drop in-process P&L trip list cache and refresh the reports page shell. */
export function invalidatePnlTripsCache() {
  clearPnlMonthTripsCache();
  try {
    revalidatePath("/reports/pnl");
  } catch {
    // Outside Next.js request context (e.g. verification scripts)
  }
}

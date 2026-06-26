import { t } from "@/lib/i18n/translate";
import type { UserLanguage } from "@/types";

/** Per-market KPB row label (Ipoh A → parking fee wording; others unchanged). */
export function getKpbFeeLabel(market: string, locale: UserLanguage): string {
  const code = market.trim().toUpperCase();
  if (code === "A") {
    return t("driverExpenses.fee.kpbParkingIpoh", locale);
  }
  return "KPB";
}

/** Label shown on voucher form / print rows, e.g.「停车费 Parking A」or「KPB BM」. */
export function formatKpbFeeRowLabel(
  market: string,
  locale: UserLanguage
): string {
  return `${getKpbFeeLabel(market, locale)} ${market}`;
}

"use server";

import { requireHistoryAccess } from "@/lib/require-auth";
import {
  getAuditFeed,
  resolveHistoryEntityTypes,
  type AuditFeedEntry,
  type HistoryTab,
} from "@/lib/audit-feed";

export type { AuditFeedEntry as HistoryAuditEntry };

function parseHistoryTab(tab?: string): HistoryTab {
  if (
    tab === "inbound" ||
    tab === "payroll" ||
    tab === "voucher" ||
    tab === "trips" ||
    tab === "invoice_collections"
  ) {
    return tab;
  }
  return "all";
}

export async function getHistoryAuditFeed(input: {
  tab?: string;
  date?: string;
}): Promise<AuditFeedEntry[]> {
  await requireHistoryAccess();
  const tab = parseHistoryTab(input.tab);
  return getAuditFeed({
    entityTypes: resolveHistoryEntityTypes(tab),
    date: input.date,
  });
}

/** @deprecated Use getHistoryAuditFeed — kept for callers expecting inbound-only shape */
export async function getInboundModifications(dateStr?: string) {
  return getHistoryAuditFeed({ tab: "inbound", date: dateStr });
}

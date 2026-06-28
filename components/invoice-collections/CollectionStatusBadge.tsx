"use client";

import { useT } from "@/components/shared/locale-context";
import type { InvoiceCollectionStatus } from "@/lib/invoice-collections-overview";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

function collectionStatusMessageKey(
  status: InvoiceCollectionStatus
): MessageKey {
  switch (status) {
    case "partial":
      return "invoiceCollections.status.partial";
    case "paid":
      return "invoiceCollections.status.paid";
    default:
      return "invoiceCollections.status.unpaid";
  }
}

const statusBadgeClass: Record<InvoiceCollectionStatus, string> = {
  paid: "bg-green-100 text-green-800",
  partial: "bg-amber-100 text-amber-900",
  unpaid: "bg-gray-100 text-gray-700",
};

export function CollectionStatusBadge({
  status,
  className,
}: {
  status: InvoiceCollectionStatus;
  className?: string;
}) {
  const { tLocal } = useT();

  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
        statusBadgeClass[status],
        className
      )}
    >
      {tLocal(collectionStatusMessageKey(status))}
    </span>
  );
}

export function PrepaymentBadge({ className }: { className?: string }) {
  const { tLocal } = useT();

  return (
    <span
      className={cn(
        "inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800",
        className
      )}
    >
      {tLocal("invoiceCollections.status.hasPrepayment")}
    </span>
  );
}

"use client";

import { useT } from "@/components/shared/locale-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INVOICE_BANK_ACCOUNTS,
  type InvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import type { InvoiceCollectionsListFilters } from "@/lib/invoice-collections-overview";
import type { InvoiceCollectionStatus } from "@/lib/invoice-collections-overview";

interface InvoiceCollectionsListFilterBarProps {
  filters: InvoiceCollectionsListFilters;
  onChange: (next: InvoiceCollectionsListFilters) => void;
  onReset: () => void;
  showReset: boolean;
}

export function InvoiceCollectionsListFilterBar({
  filters,
  onChange,
  onReset,
  showReset,
}: InvoiceCollectionsListFilterBarProps) {
  const { t } = useT();

  return (
    <section className="rounded-xl border border-haidee-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-haidee-text">
            {t("invoiceCollections.filters.title")}
          </p>
          <p className="text-xs text-haidee-muted">
            {t("invoiceCollections.filters.scopeHint")}
          </p>
        </div>
        {showReset ? (
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            {t("invoiceCollections.filters.reset")}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-haidee-muted">
            {t("invoiceCollections.filters.customer")}
          </span>
          <Input
            value={filters.customerQuery}
            placeholder={t("invoiceCollections.filters.customerPlaceholder")}
            onChange={(event) =>
              onChange({ ...filters, customerQuery: event.target.value })
            }
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-haidee-muted">
            {t("invoiceCollections.filters.bankAccount")}
          </span>
          <Select
            value={filters.bankAccount || "ALL"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                bankAccount:
                  value === "ALL" ? "" : (value as InvoiceBankAccount),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                {t("invoiceCollections.filters.all")}
              </SelectItem>
              {INVOICE_BANK_ACCOUNTS.map((account) => (
                <SelectItem key={account.value} value={account.value}>
                  {t(account.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-haidee-muted">
            {t("invoiceCollections.filters.status")}
          </span>
          <Select
            value={filters.status || "ALL"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                status:
                  value === "ALL" ? "" : (value as InvoiceCollectionStatus),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                {t("invoiceCollections.filters.all")}
              </SelectItem>
              <SelectItem value="unpaid">
                {t("invoiceCollections.status.unpaid")}
              </SelectItem>
              <SelectItem value="partial">
                {t("invoiceCollections.status.partial")}
              </SelectItem>
              <SelectItem value="paid">
                {t("invoiceCollections.status.paid")}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-haidee-muted">
            {t("invoiceCollections.filters.currency")}
          </span>
          <Select
            value={filters.currency || "ALL"}
            onValueChange={(value) =>
              onChange({
                ...filters,
                currency: value === "ALL" ? "" : (value as "THB" | "MYR"),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                {t("invoiceCollections.filters.all")}
              </SelectItem>
              <SelectItem value="THB">THB</SelectItem>
              <SelectItem value="MYR">MYR</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
    </section>
  );
}

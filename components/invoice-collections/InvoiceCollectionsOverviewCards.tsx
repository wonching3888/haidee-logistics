"use client";

import type { InvoiceCollectionsOverview } from "@/lib/invoice-collections-overview";
import { useT } from "@/components/shared/locale-context";
import {
  invoiceBankAccountLabelKey,
  type InvoiceBankAccount,
} from "@/lib/constants/invoice-bank-accounts";
import type { ReceivableCurrency } from "@/lib/receivable-invoices";

function formatMoney(value: number, currency: string) {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function CurrencyOverviewCard({
  overview,
}: {
  overview: InvoiceCollectionsOverview["thb"];
}) {
  const { t } = useT();
  const currency = overview.currency as ReceivableCurrency;
  const titleKey =
    currency === "THB"
      ? "invoiceCollections.overview.thbTitle"
      : "invoiceCollections.overview.myrTitle";

  return (
    <div className="rounded-xl border border-haidee-border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-haidee-text">{t(titleKey)}</p>
      <p className="mt-1 text-xs text-haidee-muted">
        {t("invoiceCollections.overview.scopeHint")}
      </p>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-haidee-muted">
            {t("invoiceCollections.overview.totalReceivable")}
          </dt>
          <dd className="font-mono font-semibold text-haidee-text">
            {formatMoney(overview.totalReceivable, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-haidee-muted">
            {t("invoiceCollections.overview.totalReceived")}
          </dt>
          <dd className="font-mono font-semibold text-haidee-text">
            {formatMoney(overview.totalReceived, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-haidee-muted">
            {t("invoiceCollections.overview.totalAllocated")}
          </dt>
          <dd className="font-mono font-semibold text-haidee-text">
            {formatMoney(overview.totalAllocated, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-haidee-muted">
            {t("invoiceCollections.overview.totalPrepaid")}
          </dt>
          <dd className="font-mono font-semibold text-haidee-text">
            {formatMoney(overview.totalPrepaid, currency)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-haidee-muted">
            {t("invoiceCollections.overview.totalOpen")}
          </dt>
          <dd className="font-mono font-semibold text-haidee-text">
            {formatMoney(overview.totalOpen, currency)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-haidee-border pt-3">
        <p className="text-xs font-medium text-haidee-text">
          {t("invoiceCollections.overview.bankBreakdownTitle")}
        </p>
        <p className="mt-0.5 text-xs text-haidee-muted">
          {t("invoiceCollections.overview.bankBreakdownHint")}
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {overview.bankAccounts.map((row) => (
            <li
              key={row.bankAccount}
              className="flex items-center justify-between gap-3"
            >
              <span>
                {t(invoiceBankAccountLabelKey(row.bankAccount as InvoiceBankAccount))}
              </span>
              <span className="font-mono">
                {formatMoney(row.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-xs text-haidee-muted">
        {overview.invoiceCount} invoices
      </p>
    </div>
  );
}

export function InvoiceCollectionsOverviewCards({
  overview,
}: {
  overview: InvoiceCollectionsOverview;
}) {
  const { t } = useT();

  return (
    <section className="space-y-3">
      <p className="text-xs text-haidee-muted">
        {t("invoiceCollections.overview.metricsLegend")}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <CurrencyOverviewCard overview={overview.thb} />
        <CurrencyOverviewCard overview={overview.myr} />
      </div>
    </section>
  );
}

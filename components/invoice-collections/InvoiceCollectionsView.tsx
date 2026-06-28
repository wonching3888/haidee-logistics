"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getInvoiceCollectionsPageData } from "@/app/actions/invoice-collections";
import { ReportAwaitingQuery } from "@/components/shared/ReportAwaitingQuery";
import { ReportFilterBar } from "@/components/shared/ReportFilterBar";
import { ReportFiltersChangedHint } from "@/components/shared/ReportFiltersChangedHint";
import { YearMonthFields } from "@/components/shared/YearMonthFields";
import { useT } from "@/components/shared/locale-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReportQuery } from "@/lib/hooks/use-report-query";
import { currentCalendarYearMonth } from "@/lib/parse-year-month-params";
import type { ReceivableCurrency, ReceivableInvoiceType } from "@/lib/receivable-invoices";
import type { MessageKey } from "@/lib/i18n/messages";

interface InvoiceCollectionsDraft {
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
}

type InvoiceCollectionsQueryData = Awaited<
  ReturnType<typeof getInvoiceCollectionsPageData>
>;

function parseIntParam(
  searchParams: Pick<URLSearchParams, "get">,
  key: string,
  fallback: number
) {
  const raw = searchParams.get(key);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : fallback;
}

function buildInitialDraft(
  searchParams: Pick<URLSearchParams, "get">
): InvoiceCollectionsDraft {
  const now = currentCalendarYearMonth();
  return {
    fromYear: parseIntParam(searchParams, "fromYear", now.year),
    fromMonth: parseIntParam(searchParams, "fromMonth", 1),
    toYear: parseIntParam(searchParams, "toYear", now.year),
    toMonth: parseIntParam(searchParams, "toMonth", now.month),
  };
}

function formatMoney(value: number, currency: string) {
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function invoiceTypeMessageKey(
  invoiceType: ReceivableInvoiceType
): MessageKey {
  switch (invoiceType) {
    case "freight":
      return "invoiceCollections.type.freight";
    case "crate_return":
      return "invoiceCollections.type.crateReturn";
    case "charter":
      return "invoiceCollections.type.charter";
    default:
      return "invoiceCollections.type.freight";
  }
}

function formatModeSuffix(
  invoiceType: ReceivableInvoiceType,
  mode?: string
) {
  if (invoiceType === "freight" && mode) {
    return ` · ${mode}`;
  }
  return "";
}

export function InvoiceCollectionsView() {
  const { t } = useT();
  const searchParams = useSearchParams();

  const customerKey = searchParams.get("customerKey");
  const currencyParam = searchParams.get("currency");
  const isDetailView = Boolean(customerKey && currencyParam);

  const initialDraft = useMemo(
    () => buildInitialDraft(searchParams),
    [searchParams]
  );

  const isDraftDirty = useCallback(
    (draft: InvoiceCollectionsDraft, applied: InvoiceCollectionsDraft | null) => {
      if (!applied) return false;
      return (
        draft.fromYear !== applied.fromYear ||
        draft.fromMonth !== applied.fromMonth ||
        draft.toYear !== applied.toYear ||
        draft.toMonth !== applied.toMonth
      );
    },
    []
  );

  const fetchData = useCallback(
    async (draft: InvoiceCollectionsDraft) => {
      return getInvoiceCollectionsPageData({
        ...draft,
        customerKey: customerKey ?? undefined,
        currency: currencyParam ?? undefined,
      });
    },
    [currencyParam, customerKey]
  );

  const buildUrlParams = useCallback(
    (draft: InvoiceCollectionsDraft) => {
      const params = new URLSearchParams();
      params.set("fromYear", String(draft.fromYear));
      params.set("fromMonth", String(draft.fromMonth));
      params.set("toYear", String(draft.toYear));
      params.set("toMonth", String(draft.toMonth));
      if (customerKey) params.set("customerKey", customerKey);
      if (currencyParam) params.set("currency", currencyParam);
      return params;
    },
    [currencyParam, customerKey]
  );

  const {
    draft,
    setDraft,
    applied,
    data,
    loading,
    error,
    hasQueried,
    filtersDirty,
    search,
  } = useReportQuery<InvoiceCollectionsDraft, InvoiceCollectionsQueryData>({
    initialDraft,
    isDraftDirty,
    fetch: fetchData,
    buildUrlParams,
    syncUrlPath: "/financial/invoice-collections",
  });

  const pageData = data;
  const detailData = pageData?.detail ?? null;

  const detailCustomerName =
    detailData?.invoices[0]?.customerName ??
    pageData?.ledgers.find(
      (row) =>
        row.customerKey === customerKey && row.currency === currencyParam
    )?.customerName ??
    customerKey;

  const listHrefForLedger = useCallback(
    (ledgerCustomerKey: string, currency: ReceivableCurrency) => {
      const params = buildUrlParams(applied ?? draft);
      params.set("customerKey", ledgerCustomerKey);
      params.set("currency", currency);
      params.set("q", "1");
      return `/financial/invoice-collections?${params.toString()}`;
    },
    [applied, buildUrlParams, draft]
  );

  const backToListHref = useMemo(() => {
    const params = buildUrlParams(applied ?? draft);
    params.delete("customerKey");
    params.delete("currency");
    return `/financial/invoice-collections?${params.toString()}`;
  }, [applied, buildUrlParams, draft]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          {t("invoiceCollections.title")}
        </h2>
        <p className="text-sm text-haidee-muted">
          {t("invoiceCollections.subtitle")}
        </p>
      </div>

      <ReportFilterBar loading={loading} onSearch={() => void search()}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-1 text-xs text-haidee-muted">From</p>
            <YearMonthFields
              year={draft.fromYear}
              month={draft.fromMonth}
              onYearChange={(fromYear) =>
                setDraft((prev) => ({ ...prev, fromYear }))
              }
              onMonthChange={(fromMonth) =>
                setDraft((prev) => ({ ...prev, fromMonth }))
              }
              monthSuffix=""
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-haidee-muted">To</p>
            <YearMonthFields
              year={draft.toYear}
              month={draft.toMonth}
              onYearChange={(toYear) =>
                setDraft((prev) => ({ ...prev, toYear }))
              }
              onMonthChange={(toMonth) =>
                setDraft((prev) => ({ ...prev, toMonth }))
              }
              monthSuffix=""
            />
          </div>
        </div>
      </ReportFilterBar>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <ReportFiltersChangedHint show={filtersDirty} />

      {!hasQueried && !loading && (
        <ReportAwaitingQuery>{t("invoiceCollections.awaitingQuery")}</ReportAwaitingQuery>
      )}

      {hasQueried && pageData && (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-haidee-border bg-white p-4 shadow-sm">
              <p className="text-sm text-haidee-muted">
                {t("invoiceCollections.overview.thb")}
              </p>
              <p className="mt-1 text-2xl font-semibold text-haidee-text">
                {formatMoney(pageData.overview.thb.totalReceivable, "THB")}
              </p>
              <p className="mt-1 text-xs text-haidee-muted">
                {pageData.overview.thb.invoiceCount} invoices
              </p>
            </div>
            <div className="rounded-xl border border-haidee-border bg-white p-4 shadow-sm">
              <p className="text-sm text-haidee-muted">
                {t("invoiceCollections.overview.myr")}
              </p>
              <p className="mt-1 text-2xl font-semibold text-haidee-text">
                {formatMoney(pageData.overview.myr.totalReceivable, "MYR")}
              </p>
              <p className="mt-1 text-xs text-haidee-muted">
                {pageData.overview.myr.invoiceCount} invoices
              </p>
            </div>
          </section>

          <p className="text-xs text-haidee-muted">
            {t("invoiceCollections.overview.bankAccountsPending")}
          </p>

          {isDetailView && detailData ? (
            <section className="space-y-4 overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-haidee-border px-4 py-3">
                <div>
                  <p className="text-sm text-haidee-muted">
                    {t("invoiceCollections.detailTitle")}
                  </p>
                  <h3 className="text-lg font-semibold text-haidee-text">
                    {detailCustomerName} · {detailData.currency}
                  </h3>
                  <p className="text-sm text-haidee-muted">
                    {t("invoiceCollections.col.totalReceivable")}:{" "}
                    <strong>
                      {formatMoney(detailData.totalReceivable, detailData.currency)}
                    </strong>
                  </p>
                </div>
                <Link
                  href={backToListHref}
                  className="text-sm font-medium text-haidee-blue hover:underline"
                >
                  {t("invoiceCollections.backToList")}
                </Link>
              </div>

              {detailData.invoices.length === 0 ? (
                <p className="px-4 py-6 text-sm text-haidee-muted">
                  {t("invoiceCollections.empty")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("invoiceCollections.col.month")}</TableHead>
                      <TableHead>{t("invoiceCollections.col.type")}</TableHead>
                      <TableHead>{t("invoiceCollections.col.invoiceNo")}</TableHead>
                      <TableHead className="text-right">
                        {t("invoiceCollections.col.amount")}
                      </TableHead>
                      <TableHead>{t("invoiceCollections.col.collectionStatus")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailData.invoices.map((invoice) => (
                      <TableRow key={invoice.invoiceKey}>
                        <TableCell>{invoice.yearMonth}</TableCell>
                        <TableCell>
                          {t(invoiceTypeMessageKey(invoice.invoiceType))}
                          {formatModeSuffix(
                            invoice.invoiceType,
                            invoice.sourceMeta.mode
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {invoice.invoiceNo ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(invoice.totalAmount, invoice.currency)}
                        </TableCell>
                        <TableCell>{t("invoiceCollections.status.unpaid")}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={invoice.printHref}
                            className="text-sm font-medium text-haidee-blue hover:underline"
                          >
                            {t("invoiceCollections.openPrint")}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          ) : (
            <section className="overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
              {pageData.ledgers.length === 0 ? (
                <p className="px-4 py-6 text-sm text-haidee-muted">
                  {t("invoiceCollections.empty")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("invoiceCollections.col.customer")}</TableHead>
                      <TableHead>{t("invoiceCollections.col.currency")}</TableHead>
                      <TableHead>{t("invoiceCollections.col.earliestMonth")}</TableHead>
                      <TableHead className="text-right">
                        {t("invoiceCollections.col.totalReceivable")}
                      </TableHead>
                      <TableHead className="text-right">
                        {t("invoiceCollections.col.invoiceCount")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageData.ledgers.map((ledger) => (
                      <TableRow key={`${ledger.customerKey}|${ledger.currency}`}>
                        <TableCell>
                          <Link
                            href={listHrefForLedger(
                              ledger.customerKey,
                              ledger.currency
                            )}
                            className="font-medium text-haidee-blue hover:underline"
                          >
                            {ledger.customerCode
                              ? `${ledger.customerName} (${ledger.customerCode})`
                              : ledger.customerName}
                          </Link>
                        </TableCell>
                        <TableCell>{ledger.currency}</TableCell>
                        <TableCell>{ledger.earliestYearMonth}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(ledger.totalReceivable, ledger.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {ledger.invoiceCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

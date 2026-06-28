"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getInvoiceCollectionsPageData } from "@/app/actions/invoice-collections";
import {
  CollectionStatusBadge,
  PrepaymentBadge,
} from "@/components/invoice-collections/CollectionStatusBadge";
import {
  InvoiceCollectionsBilingualHead,
  InvoiceCollectionsBilingualLabel,
} from "@/components/invoice-collections/InvoiceCollectionsBilingualHead";
import { InvoiceCollectionsListFilterBar } from "@/components/invoice-collections/InvoiceCollectionsListFilterBar";
import { InvoiceCollectionsOverviewCards } from "@/components/invoice-collections/InvoiceCollectionsOverviewCards";
import { InvoicePaymentDialog } from "@/components/invoice-collections/InvoicePaymentDialog";
import { InvoicePaymentSection } from "@/components/invoice-collections/InvoicePaymentSection";
import { ReportAwaitingQuery } from "@/components/shared/ReportAwaitingQuery";
import { ReportFilterBar } from "@/components/shared/ReportFilterBar";
import { ReportFiltersChangedHint } from "@/components/shared/ReportFiltersChangedHint";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
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
import {
  buildInvoiceCollectionsUrlScopeKey,
  isDetailDataForUrlScope,
} from "@/lib/invoice-collections-detail";
import {
  applyListFiltersToUrlParams,
  EMPTY_INVOICE_COLLECTIONS_LIST_FILTERS,
  filterInvoiceCollectionLedgers,
  hasActiveListFilters,
  parseInvoiceCollectionsListFilters,
  type InvoiceCollectionsListFilters,
} from "@/lib/invoice-collections-overview";
import type { InvoiceBankAccount } from "@/lib/constants/invoice-bank-accounts";
import { currentCalendarYearMonth } from "@/lib/parse-year-month-params";
import { isReportQueryRequested } from "@/lib/reports/report-query-params";
import {
  FIRST_COL_WIDTH,
  STICKY_BODY_FIRST,
  STICKY_HEAD_FIRST,
  stickyFirstColTableClass,
} from "@/lib/table-scroll";
import type { ReceivableCurrency, ReceivableInvoiceType } from "@/lib/receivable-invoices";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const LIST_SCROLL_STORAGE_KEY = "invoice-collections-list-scroll-y";
const DETAIL_INVOICE_TABLE_HEIGHT = 280;

/** Stacked bilingual headers allow a narrower customer column. */
const CUSTOMER_COL_WIDTH = "min-w-[9.5rem] max-w-[9.5rem] w-[9.5rem]";
const COMPACT_COL = "min-w-[4.25rem] max-w-[5.5rem] w-[4.75rem]";
const COMPACT_COL_RIGHT = cn(COMPACT_COL, "text-right");
const STATUS_COL = "min-w-[4.5rem] max-w-[5.5rem] w-[5rem]";
const COUNT_COL = "min-w-[3rem] max-w-[3.5rem] w-[3.25rem] text-right";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const customerKey = searchParams.get("customerKey");
  const currencyParam = searchParams.get("currency");
  const isDetailView = Boolean(customerKey && currencyParam);

  const listFilters = useMemo(
    () => parseInvoiceCollectionsListFilters(searchParams),
    [searchParams]
  );

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
      applyListFiltersToUrlParams(params, listFilters);
      return params;
    },
    [currencyParam, customerKey, listFilters]
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
    refetch,
  } = useReportQuery<InvoiceCollectionsDraft, InvoiceCollectionsQueryData>({
    initialDraft,
    isDraftDirty,
    fetch: fetchData,
    buildUrlParams,
    syncUrlPath: "/financial/invoice-collections",
  });

  const queryDraft = applied ?? draft;

  const syncListFiltersToUrl = useCallback(
    (next: InvoiceCollectionsListFilters) => {
      const params = buildUrlParams(applied ?? draft);
      applyListFiltersToUrlParams(params, next);
      if (hasQueried || isReportQueryRequested(searchParams)) {
        params.set("q", "1");
      }
      router.replace(`/financial/invoice-collections?${params.toString()}`, {
        scroll: false,
      });
    },
    [applied, buildUrlParams, draft, hasQueried, router, searchParams]
  );

  const urlScopeKey = buildInvoiceCollectionsUrlScopeKey({
    customerKey,
    currency: currencyParam,
    fromYear: queryDraft.fromYear,
    fromMonth: queryDraft.fromMonth,
    toYear: queryDraft.toYear,
    toMonth: queryDraft.toMonth,
  });
  const urlScopeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasQueried || !isReportQueryRequested(searchParams)) return;

    if (urlScopeRef.current === null) {
      urlScopeRef.current = urlScopeKey;
      return;
    }

    if (urlScopeRef.current === urlScopeKey) return;

    urlScopeRef.current = urlScopeKey;
    void refetch(applied ?? draft);
  }, [
    applied,
    draft,
    hasQueried,
    refetch,
    searchParams,
    urlScopeKey,
  ]);

  useEffect(() => {
    setPaymentDialogOpen(false);
  }, [customerKey, currencyParam]);

  useEffect(() => {
    if (isDetailView || !hasQueried) return;

    const raw = sessionStorage.getItem(LIST_SCROLL_STORAGE_KEY);
    if (raw == null) return;

    sessionStorage.removeItem(LIST_SCROLL_STORAGE_KEY);
    const y = Number(raw);
    if (!Number.isFinite(y) || y < 0) return;

    requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
    });
  }, [hasQueried, isDetailView]);

  const saveListScrollPosition = useCallback(() => {
    sessionStorage.setItem(LIST_SCROLL_STORAGE_KEY, String(window.scrollY));
  }, []);

  const pageData = data;
  const detailData = pageData?.detail ?? null;
  const canWritePayments = pageData?.canWritePayments ?? false;

  const ledgerBankAccounts = useMemo(() => {
    const map = new Map<string, InvoiceBankAccount[]>();
    if (!pageData?.ledgerBankAccounts) return map;
    for (const [key, banks] of Object.entries(pageData.ledgerBankAccounts)) {
      map.set(key, banks);
    }
    return map;
  }, [pageData?.ledgerBankAccounts]);

  const filteredLedgers = useMemo(() => {
    if (!pageData) return [];
    return filterInvoiceCollectionLedgers(
      pageData.ledgers,
      ledgerBankAccounts,
      listFilters
    );
  }, [ledgerBankAccounts, listFilters, pageData]);

  const listFiltersActive = hasActiveListFilters(listFilters);

  const verifiedDetail = isDetailDataForUrlScope(
    detailData,
    customerKey,
    currencyParam
  )
    ? detailData
    : null;

  const ledgerForUrl =
    customerKey && currencyParam
      ? pageData?.ledgers.find(
          (row) =>
            row.customerKey === customerKey && row.currency === currencyParam
        )
      : undefined;

  const detailCustomerName = verifiedDetail
    ? (verifiedDetail.invoices[0]?.customerName ??
      ledgerForUrl?.customerName ??
      customerKey)
    : (ledgerForUrl?.customerName ?? customerKey ?? "");

  const showDetailLoading = isDetailView && hasQueried && !verifiedDetail;

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
    if (hasQueried || isReportQueryRequested(searchParams)) {
      params.set("q", "1");
    }
    return `/financial/invoice-collections?${params.toString()}`;
  }, [applied, buildUrlParams, draft, hasQueried, searchParams]);

  return (
    <div className="space-y-6">
      {!isDetailView ? (
        <>
          <div>
            <InvoiceCollectionsBilingualLabel
              messageKey="invoiceCollections.title"
              titleClassName="text-2xl font-bold"
            />
            <InvoiceCollectionsBilingualLabel
              messageKey="invoiceCollections.subtitle"
              className="mt-1"
              titleClassName="text-sm font-normal text-haidee-muted"
              subtitleClassName="text-[10px]"
            />
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
        </>
      ) : null}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isDetailView ? <ReportFiltersChangedHint show={filtersDirty} /> : null}

      {!hasQueried && !loading && (
        <ReportAwaitingQuery>{t("invoiceCollections.awaitingQuery")}</ReportAwaitingQuery>
      )}

      {hasQueried && pageData && (
        <>
          {!isDetailView ? (
            <InvoiceCollectionsOverviewCards overview={pageData.overview} />
          ) : null}

          {showDetailLoading ? (
            <section className="rounded-xl border border-haidee-border bg-white px-4 py-12 shadow-sm">
              <p className="text-center text-sm text-haidee-muted">
                {loading
                  ? t("invoiceCollections.loadingDetail")
                  : t("invoiceCollections.loadFailed")}
              </p>
            </section>
          ) : verifiedDetail && customerKey && currencyParam ? (
            <section className="rounded-xl border border-haidee-border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-haidee-border px-4 py-2">
                <div>
                  <InvoiceCollectionsBilingualLabel
                    messageKey="invoiceCollections.detailTitle"
                    titleClassName="text-sm"
                    subtitleClassName="text-[10px]"
                  />
                  <h3 className="mt-1 text-lg font-semibold text-haidee-text">
                    {detailCustomerName} · {verifiedDetail.currency}
                  </h3>
                  <p className="mt-0.5 text-sm text-haidee-muted">
                    {t("invoiceCollections.col.totalReceivable")}:{" "}
                    <strong>
                      {formatMoney(
                        verifiedDetail.totalReceivable,
                        verifiedDetail.currency
                      )}
                    </strong>
                    {" · "}
                    {t("invoiceCollections.col.open")}:{" "}
                    <strong>
                      {formatMoney(verifiedDetail.totalOpen, verifiedDetail.currency)}
                    </strong>
                  </p>
                </div>
                <Link
                  href={backToListHref}
                  scroll={false}
                  className="text-sm font-medium text-haidee-blue hover:underline"
                >
                  {t("invoiceCollections.backToList")}
                </Link>
              </div>

              <InvoicePaymentSection
                payments={verifiedDetail.payments}
                currency={verifiedDetail.currency}
                currentCustomerKey={verifiedDetail.customerKey}
                ledgerOptions={pageData.ledgers.map((ledger) => ({
                  customerKey: ledger.customerKey,
                  customerKind: ledger.customerKind,
                  customerId: ledger.customerId,
                  customerName: ledger.customerName,
                  currency: ledger.currency,
                }))}
                manualInvoiceOptions={verifiedDetail.invoices.map((invoice) => ({
                  invoiceType: invoice.invoiceType,
                  invoiceKey: invoice.invoiceKey,
                  invoiceNo: invoice.invoiceNo,
                  yearMonth: invoice.yearMonth,
                  totalAmount: invoice.totalAmount,
                  allocatedAmount: invoice.allocatedAmount,
                }))}
                canWritePayments={canWritePayments}
                onAddPayment={() => setPaymentDialogOpen(true)}
                onPaymentsChanged={() => void refetch(queryDraft)}
              />

              {verifiedDetail.invoices.length === 0 ? (
                <p className="px-4 py-6 text-sm text-haidee-muted">
                  {t("invoiceCollections.empty")}
                </p>
              ) : (
                <ScrollMatrixTable
                  className="border-0 shadow-none rounded-none"
                  style={{
                    height: DETAIL_INVOICE_TABLE_HEIGHT,
                    maxHeight: DETAIL_INVOICE_TABLE_HEIGHT,
                  }}
                >
                  <Table noScrollContainer className={stickyFirstColTableClass}>
                    <TableHeader>
                      <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.month"
                          className={cn(FIRST_COL_WIDTH, STICKY_HEAD_FIRST)}
                        />
                        <InvoiceCollectionsBilingualHead messageKey="invoiceCollections.col.type" />
                        <InvoiceCollectionsBilingualHead messageKey="invoiceCollections.col.invoiceNo" />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.total"
                          align="right"
                          className={COMPACT_COL_RIGHT}
                        />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.allocated"
                          align="right"
                          className={COMPACT_COL_RIGHT}
                        />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.open"
                          align="right"
                          className={COMPACT_COL_RIGHT}
                        />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.collectionStatus"
                          className={STATUS_COL}
                        />
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verifiedDetail.invoices.map((invoice) => (
                        <TableRow key={invoice.invoiceKey}>
                          <TableCell className={cn(FIRST_COL_WIDTH, STICKY_BODY_FIRST)}>
                            {invoice.yearMonth}
                          </TableCell>
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
                          <TableCell className="text-right font-mono">
                            {formatMoney(invoice.allocatedAmount, invoice.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatMoney(invoice.openAmount, invoice.currency)}
                          </TableCell>
                          <TableCell>
                            <CollectionStatusBadge status={invoice.collectionStatus} />
                            {invoice.isOverAllocated ? (
                              <span className="mt-0.5 block text-xs font-medium text-red-600">
                                {t("invoiceCollections.status.overAllocated")}
                              </span>
                            ) : null}
                          </TableCell>
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
                </ScrollMatrixTable>
              )}
              <InvoicePaymentDialog
                open={paymentDialogOpen}
                onClose={() => setPaymentDialogOpen(false)}
                onSaved={() => void refetch(queryDraft)}
                customerKey={verifiedDetail.customerKey}
                customerName={detailCustomerName}
                customerCode={
                  verifiedDetail.invoices[0]?.customerCode ??
                  ledgerForUrl?.customerCode ??
                  null
                }
                customerKind={
                  verifiedDetail.invoices[0]?.customerKind ??
                  ledgerForUrl?.customerKind ??
                  "shipper"
                }
                customerId={
                  verifiedDetail.invoices[0]?.customerId ??
                  ledgerForUrl?.customerId ??
                  null
                }
                currency={verifiedDetail.currency}
                openInvoices={verifiedDetail.invoices
                  .filter((invoice) => invoice.openAmount > 0)
                  .map((invoice) => ({
                    yearMonth: invoice.yearMonth,
                    invoiceNo: invoice.invoiceNo,
                    invoiceKey: invoice.invoiceKey,
                    totalAmount: invoice.totalAmount,
                    openAmount: invoice.openAmount,
                  }))}
              />
            </section>
          ) : !isDetailView && pageData.ledgers.length > 0 ? (
            <>
              <InvoiceCollectionsListFilterBar
                filters={listFilters}
                onChange={syncListFiltersToUrl}
                onReset={() =>
                  syncListFiltersToUrl(EMPTY_INVOICE_COLLECTIONS_LIST_FILTERS)
                }
                showReset={listFiltersActive}
              />

              {filteredLedgers.length === 0 ? (
                <section className="rounded-xl border border-haidee-border bg-white px-4 py-6 shadow-sm">
                  <p className="text-sm text-haidee-muted">
                    {t("invoiceCollections.filters.noResults")}
                  </p>
                </section>
              ) : (
                <ScrollMatrixTable heightOffset={300}>
                  <Table noScrollContainer className={stickyFirstColTableClass}>
                    <TableHeader>
                      <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.customer"
                          className={cn(CUSTOMER_COL_WIDTH, STICKY_HEAD_FIRST)}
                        />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.currency"
                          className={COMPACT_COL}
                        />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.earliestMonth"
                          className={COMPACT_COL}
                        />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.totalReceivable"
                          align="right"
                          className={COMPACT_COL_RIGHT}
                        />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.received"
                          align="right"
                          className={COMPACT_COL_RIGHT}
                        />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.open"
                          align="right"
                          className={COMPACT_COL_RIGHT}
                        />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.collectionStatus"
                          className={STATUS_COL}
                        />
                        <InvoiceCollectionsBilingualHead
                          messageKey="invoiceCollections.col.invoiceCount"
                          align="right"
                          className={COUNT_COL}
                        />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLedgers.map((ledger) => (
                        <TableRow key={`${ledger.customerKey}|${ledger.currency}`}>
                          <TableCell
                            className={cn(
                              CUSTOMER_COL_WIDTH,
                              STICKY_BODY_FIRST,
                              "whitespace-normal align-top"
                            )}
                          >
                            <Link
                              href={listHrefForLedger(
                                ledger.customerKey,
                                ledger.currency
                              )}
                              scroll={false}
                              onClick={saveListScrollPosition}
                              className="block font-medium leading-snug text-haidee-blue hover:underline"
                            >
                              <span className="block break-words">
                                {ledger.customerName}
                              </span>
                              {ledger.customerCode ? (
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {ledger.customerCode}
                                </span>
                              ) : null}
                            </Link>
                          </TableCell>
                          <TableCell>{ledger.currency}</TableCell>
                          <TableCell>{ledger.earliestYearMonth}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatMoney(ledger.totalReceivable, ledger.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatMoney(ledger.totalAllocated, ledger.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatMoney(ledger.totalOpen, ledger.currency)}
                          </TableCell>
                          <TableCell>
                            <CollectionStatusBadge status={ledger.collectionStatus} />
                            {ledger.hasPrepayment ? (
                              <PrepaymentBadge className="mt-0.5" />
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            {ledger.invoiceCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollMatrixTable>
              )}
            </>
          ) : pageData.ledgers.length === 0 ? (
            <section className="rounded-xl border border-haidee-border bg-white px-4 py-6 shadow-sm">
              <p className="text-sm text-haidee-muted">
                {t("invoiceCollections.empty")}
              </p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

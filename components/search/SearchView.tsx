"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useReactToPrint } from "react-to-print";
import { ChevronDown, Printer, Search } from "lucide-react";
import type { SearchResult } from "@/app/actions/search";
import { DispatchMarketLabel } from "@/components/dispatch/DispatchMarketLabel";
import { DateInputField } from "@/components/shared/DateInputField";
import { MobileTruncatedName } from "@/components/shared/MobileTruncatedName";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { stickyFirstColTableClass } from "@/lib/table-scroll";
import { formatDisplay, normalizeDateRange } from "@/lib/date-utils";
import { DISPATCH_MARKET_ORDER } from "@/lib/markets";
import {
  buildSearchFilterSummaryLines,
  hasActiveSearchFilters,
  searchFiltersToUrlParams,
  type SearchFilters,
} from "@/lib/search-filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PdfSharePayload } from "@/lib/print-pdf-share";
import { cn } from "@/lib/utils";

const PrintPdfSharePrototype = dynamic(
  () =>
    import("@/components/documents/PrintPdfSharePrototype").then(
      (mod) => mod.PrintPdfSharePrototype
    ),
  { ssr: false }
);

interface ShipperOption {
  id: string;
  name: string;
  code: string;
}

interface TongTypeOption {
  id: string;
  code: string;
  name: string;
}

interface SearchViewProps {
  filters: SearchFilters;
  data: SearchResult;
  shippers: ShipperOption[];
  tongTypes: TongTypeOption[];
}

function sumQuantities(rows: SearchResult["rows"]) {
  let crateTotal = 0;
  let boxTotal = 0;
  for (const row of rows) {
    if (row.isBox) {
      boxTotal += row.quantity;
    } else {
      crateTotal += row.quantity;
    }
  }
  return { crateTotal, boxTotal };
}

export function SearchView({
  filters,
  data,
  shippers,
  tongTypes,
}: SearchViewProps) {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(!!filters.keyword.trim());
  const [dateError, setDateError] = useState<string | null>(null);

  const [local, setLocal] = useState(filters);

  const canPrint = data.rows.length > 0;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `search-${filters.fromDate}-${filters.toDate}`,
  });

  useEffect(() => {
    setLocal(filters);
    if (filters.keyword.trim()) {
      setAdvancedOpen(true);
    }
  }, [filters]);

  const filtersActive = hasActiveSearchFilters(local);

  function updateLocal(patch: Partial<SearchFilters>) {
    setLocal((prev) => ({ ...prev, ...patch }));
  }

  function toggleMarket(code: string) {
    setLocal((prev) => {
      const selected = prev.marketCodes.includes(code);
      return {
        ...prev,
        marketCodes: selected
          ? prev.marketCodes.filter((c) => c !== code)
          : [...prev.marketCodes, code],
      };
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!local.fromDate.trim() || !local.toDate.trim()) {
      setDateError("请选择日期 Please select a date range");
      return;
    }
    setDateError(null);
    const { from, to } = normalizeDateRange(local.fromDate, local.toDate);
    const nextFilters: SearchFilters = { ...local, fromDate: from, toDate: to };
    const params = searchFiltersToUrlParams(nextFilters);
    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }

  const displayFrom = formatDisplay(filters.fromDate);
  const displayTo = formatDisplay(filters.toDate);
  const dateRangeLabel =
    filters.fromDate === filters.toDate
      ? displayFrom
      : `${displayFrom} — ${displayTo}`;

  const filterSummaryLines = useMemo(
    () =>
      buildSearchFilterSummaryLines(filters, { shippers, tongTypes }),
    [filters, shippers, tongTypes]
  );

  const sharePayload = useMemo((): PdfSharePayload | null => {
    if (!canPrint) return null;
    const parts = [`日期 ${dateRangeLabel}`, ...filterSummaryLines];
    return {
      fileName: `search-${filters.fromDate}-${filters.toDate}.pdf`,
      title: "查询结果 Search Results",
      text: parts.join(" · "),
    };
  }, [canPrint, dateRangeLabel, filterSummaryLines, filters.fromDate, filters.toDate]);

  const filterFields = (
    <>
      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">
          开始日期 Date From
        </label>
        <DateInputField
          value={local.fromDate}
          onChange={(value) => updateLocal({ fromDate: value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">
          结束日期 Date To
        </label>
        <DateInputField
          value={local.toDate}
          onChange={(value) => updateLocal({ toDate: value })}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">
          寄货人 Consignor
        </label>
        <select
          value={local.shipperId}
          onChange={(e) => updateLocal({ shipperId: e.target.value })}
          className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm"
        >
          <option value="">全部 All</option>
          {shippers.map((shipper) => (
            <option key={shipper.id} value={shipper.id}>
              {shipper.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">
          桶型 Crate Type
        </label>
        <select
          value={local.tongTypeId}
          onChange={(e) => updateLocal({ tongTypeId: e.target.value })}
          className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 text-sm"
        >
          <option value="">全部 All</option>
          {tongTypes.map((tongType) => (
            <option key={tongType.id} value={tongType.id}>
              {tongType.code}
              {tongType.name ? ` — ${tongType.name}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1 sm:col-span-2 lg:col-span-4">
        <label className="text-xs font-medium text-haidee-muted">
          市场 Market
        </label>
        <div className="flex flex-wrap gap-2">
          {DISPATCH_MARKET_ORDER.map((code) => {
            const checked = local.marketCodes.includes(code);
            return (
              <label
                key={code}
                className="flex min-h-[40px] cursor-pointer items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMarket(code)}
                  className="h-4 w-4 accent-haidee-navy"
                />
                <DispatchMarketLabel code={code} selected={checked} />
              </label>
            );
          })}
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">
          车牌 Plate
        </label>
        <Input
          value={local.plate}
          onChange={(e) => updateLocal({ plate: e.target.value })}
          placeholder="模糊匹配 Partial match"
          className="min-h-[44px]"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-haidee-muted">
          单号 Doc No
        </label>
        <Input
          value={local.docNo}
          onChange={(e) => updateLocal({ docNo: e.target.value })}
          placeholder="进货单 / 派车单 IN or dispatch no"
          className="min-h-[44px]"
        />
      </div>
      <div className="space-y-1 sm:col-span-2 lg:col-span-2">
        <button
          type="button"
          className="flex min-h-[44px] w-full items-center gap-2 text-left text-xs font-medium text-haidee-muted"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              advancedOpen && "rotate-180"
            )}
            aria-hidden
          />
          备注/其他 Other (optional)
        </button>
        {advancedOpen ? (
          <Input
            value={local.keyword}
            onChange={(e) => updateLocal({ keyword: e.target.value })}
            placeholder="备注 / 收货地点 / 档口…"
            className="min-h-[44px]"
          />
        ) : null}
      </div>
    </>
  );

  const actionButtons = (
    <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4 md:flex-row md:flex-wrap md:items-end">
      <Button
        type="submit"
        disabled={isPending}
        className="min-h-[44px] gap-2 bg-haidee-blue text-white hover:bg-haidee-blue/90 max-md:w-full"
      >
        <Search className="h-4 w-4" />
        {isPending ? "查询中…" : "查询 Search"}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={!canPrint}
        onClick={() => handlePrint()}
        className="min-h-[44px] gap-2 max-md:w-full"
      >
        <Printer className="h-4 w-4" />
        打印 Print
      </Button>
      {sharePayload ? (
        <PrintPdfSharePrototype
          getContentElement={() => printRef.current}
          payload={sharePayload}
        />
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSearch}
        className="overflow-hidden rounded-xl border border-haidee-border bg-white print:hidden"
      >
        <button
          type="button"
          className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left md:hidden"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          <span className="flex min-w-0 items-center gap-2 font-medium text-haidee-text">
            <span className="truncate">筛选 Filters</span>
            {filtersActive ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-haidee-blue/10 px-2 py-0.5 text-xs font-medium text-haidee-blue">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-haidee-blue"
                  aria-hidden
                />
                <span aria-hidden>已选</span>
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-haidee-muted transition-transform duration-200",
              mobileOpen && "rotate-180"
            )}
            aria-hidden
          />
        </button>

        <div
          className={cn(
            "grid gap-3 border-haidee-border p-4 sm:grid-cols-2 lg:grid-cols-4",
            mobileOpen ? "grid border-t" : "hidden",
            "md:grid md:border-t-0"
          )}
        >
          {filterFields}
          {actionButtons}
        </div>
        {dateError ? (
          <p className="border-t border-haidee-border px-4 py-2 text-sm text-haidee-red">
            {dateError}
          </p>
        ) : null}
      </form>

      {data.truncated && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
          结果过多（已显示前 3000 条），请缩小日期或增加筛选条件。
          Too many results (showing first 3000). Narrow the date range or add
          filters.
        </div>
      )}

      {data.truckHeader && (
        <div className="rounded-xl border border-haidee-blue/30 bg-haidee-blue/5 px-4 py-3 text-sm print:hidden">
          <span className="font-medium text-haidee-text">
            车牌 Plate:{" "}
            <span className="font-mono">{data.truckHeader.plate}</span>
          </span>
          <span className="mx-3 text-haidee-muted">|</span>
          <span className="font-medium text-haidee-text">
            司机 Driver: {data.truckHeader.driverName}
          </span>
          <span className="mx-3 text-haidee-muted">|</span>
          <span className="font-medium text-haidee-text">
            总计 Total:{" "}
            <span className="font-mono">{data.truckHeader.totalCrates}</span> 桶
          </span>
        </div>
      )}

      <div
        ref={printRef}
        className="search-print overflow-hidden rounded-xl border border-haidee-border bg-white"
      >
        <div className="hidden border-b border-haidee-border px-4 py-3 print:block">
          <h3 className="text-lg font-bold text-haidee-text">
            查询结果 Search Results
          </h3>
          <p className="text-sm text-haidee-muted">日期 Date：{dateRangeLabel}</p>
          {filterSummaryLines.map((line) => (
            <p key={line} className="text-sm text-haidee-muted">
              {line}
            </p>
          ))}
          {data.truncated && (
            <p className="text-sm text-haidee-muted">
              结果过多（前 3000 条）Too many results (first 3000 shown)
            </p>
          )}
        </div>

        <SearchResults rows={data.rows} searched />
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          .search-print {
            font-size: 10px !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .search-print table {
            font-size: 9px !important;
          }
        }
      `}</style>
    </div>
  );
}

function SearchResults({
  rows,
  searched,
}: {
  rows: SearchResult["rows"];
  searched: boolean;
}) {
  const { crateTotal, boxTotal } = useMemo(() => sumQuantities(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="p-12 text-center text-haidee-muted print:hidden">
        {searched
          ? "无匹配结果 No matching records"
          : "请选择条件后查询 Set filters and search"}
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-haidee-border md:hidden print:hidden">
        {rows.map((row, i) => (
          <div
            key={`${row.date}-${row.sessionNo}-${row.shipperName}-${row.stallCode}-${row.tongTypeCode}-${row.truckPlate}-${i}`}
            className="space-y-3 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm text-haidee-muted">
                  {formatDisplay(row.date)}
                </p>
                {row.sessionNo ? (
                  <p className="mt-0.5 font-mono text-xs text-haidee-muted">
                    {row.sessionNo}
                  </p>
                ) : null}
                <p className="mt-1 font-medium text-haidee-text">
                  <MobileTruncatedName text={row.shipperName} />
                </p>
                {row.areaNote?.trim() && (
                  <p className="text-xs text-haidee-muted">
                    ({row.areaNote.trim()})
                  </p>
                )}
                <p className="text-xs text-haidee-muted">
                  {row.pickupLocationLabel}
                </p>
              </div>
              <p className="shrink-0 font-mono text-lg font-bold text-haidee-blue">
                {row.quantity}
                {row.isBox ? " 盒" : " 桶"}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-haidee-muted">收货人 Receiver</dt>
                <dd className="font-mono font-medium text-haidee-text">
                  {row.stallCode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-haidee-muted">桶型 Type</dt>
                <dd className="font-mono font-medium text-haidee-text">
                  {row.tongTypeCode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-haidee-muted">市场 Market</dt>
                <dd className="font-mono font-medium text-haidee-text">
                  {row.marketCode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-haidee-muted">车牌 Plate</dt>
                <dd
                  className={
                    row.truckPlate === "未派车"
                      ? "text-haidee-muted"
                      : "font-mono font-medium text-haidee-text"
                  }
                >
                  {row.truckPlate}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <ScrollMatrixTable heightOffset={320} className="hidden md:block print:block">
        <Table noScrollContainer className={stickyFirstColTableClass}>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>日期 Date</TableHead>
              <TableHead>进货单号 Session</TableHead>
              <TableHead>寄货人 Consignor</TableHead>
              <TableHead>收货地点 Pickup</TableHead>
              <TableHead>收货人 Store</TableHead>
              <TableHead>桶型 Crate</TableHead>
              <TableHead className="text-right">数量 Qty</TableHead>
              <TableHead>市场 Market</TableHead>
              <TableHead>车牌 Plate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={`${row.date}-${row.sessionNo}-${row.shipperName}-${row.stallCode}-${row.tongTypeCode}-${row.truckPlate}-${i}`}
              >
                <TableCell className="whitespace-nowrap font-mono">
                  {formatDisplay(row.date)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {row.sessionNo ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-haidee-text">
                    {row.shipperName}
                  </div>
                  {row.areaNote?.trim() && (
                    <div className="text-xs text-haidee-muted">
                      ({row.areaNote.trim()})
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{row.pickupLocationLabel}</TableCell>
                <TableCell className="font-mono">{row.stallCode}</TableCell>
                <TableCell className="font-mono">{row.tongTypeCode}</TableCell>
                <TableCell className="text-right font-mono">
                  {row.quantity}
                  {row.isBox ? " 盒" : " 桶"}
                </TableCell>
                <TableCell className="font-mono">{row.marketCode}</TableCell>
                <TableCell
                  className={
                    row.truckPlate === "未派车"
                      ? "text-haidee-muted"
                      : "font-mono"
                  }
                >
                  {row.truckPlate}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollMatrixTable>
      {(crateTotal > 0 || boxTotal > 0) && (
        <div className="border-t border-haidee-border px-4 py-3 text-sm font-semibold text-haidee-text">
          {crateTotal > 0 && <div>总计 {crateTotal} 桶</div>}
          {boxTotal > 0 && <div>总计 {boxTotal} 盒</div>}
        </div>
      )}
      <p className="border-t border-haidee-border px-4 py-2 text-xs text-haidee-muted">
        共 {rows.length} 条记录 {rows.length} record(s)
      </p>
    </>
  );
}

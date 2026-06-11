"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInputField } from "@/components/shared/DateInputField";
import { CrateByTypePrint } from "@/components/documents/CrateByTypePrint";
import { PrintPreviewDialog } from "@/components/documents/PrintPreviewDialog";
import { getCrateByTypeData, type CrateByTypeData } from "@/app/actions/documents";
import { MARKET_ORDER } from "@/lib/markets";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DispatchOrderRow {
  id: string;
  dispatchNo: string | null;
  doNumber: string;
  truckPlate: string;
  driverName: string | null;
  markets: string[];
  totalQty: number;
}

interface MarketTongCombo {
  marketCode: string;
  tongCode: string;
  tongHeader: string;
  quantity: number;
}

const marketLabelClass =
  "rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700";

function MarketLabel({ code }: { code: string }) {
  return <span className={marketLabelClass}>{code}</span>;
}

interface DocumentsClientProps {
  date: string;
  dispatchOrders: DispatchOrderRow[];
  marketTongCombos: MarketTongCombo[];
}

export function DocumentsClient({
  date,
  dispatchOrders,
  marketTongCombos,
}: DocumentsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(
    dispatchOrders[0]?.id ?? ""
  );
  const [cratePreview, setCratePreview] = useState<CrateByTypeData | null>(null);
  const [cratePreviewTitle, setCratePreviewTitle] = useState("");
  const [selectedCombos, setSelectedCombos] = useState<Set<string>>(new Set());
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);

  function changeDate(newDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", newDate);
    router.push(`/documents?${params.toString()}`);
  }

  function openInternalDO(external: boolean) {
    if (!selectedId) return;
    const path = external
      ? "/documents/do-external"
      : "/documents/do-internal";
    router.push(`${path}?dispatchId=${encodeURIComponent(selectedId)}`);
  }

  function openMarketDO() {
    if (selectedMarkets.length === 0) return;
    const params = new URLSearchParams();
    params.set("date", date);
    params.set("markets", selectedMarkets.join(","));
    router.push(`/documents/do-market?${params.toString()}`);
  }

  async function openCrateByType(marketCode: string, tongCode: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        const data = await getCrateByTypeData(date, marketCode, tongCode);
        if (!data || data.rows.length === 0) {
          setActionError("当日无该桶型记录 No records for this crate type");
          return;
        }
        setCratePreviewTitle(`桶型记录 Crate — ${marketCode} / ${tongCode}`);
        setCratePreview(data);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "生成桶型记录失败");
      }
    });
  }

  function toggleCombo(key: string) {
    setSelectedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const crateDocTitle = cratePreview
    ? `Crate-${cratePreview.marketCode}-${cratePreview.tongCode}-${date}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">
            日期 Date
          </label>
          <DateInputField value={date} onChange={changeDate} />
        </div>
      </div>

      {actionError && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {actionError}
        </p>
      )}

      {/* Dispatch orders list */}
      <div className="rounded-xl border border-haidee-border bg-white">
        <div className="border-b border-haidee-border px-4 py-3">
          <h3 className="font-semibold text-haidee-text">
            当日派车单 Dispatch Orders
          </h3>
        </div>
        {dispatchOrders.length === 0 ? (
          <p className="p-8 text-center text-haidee-muted">
            当日暂无派车单 No dispatch orders for this date
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead className="w-10"></TableHead>
                <TableHead>派车单号</TableHead>
                <TableHead>D/O No.</TableHead>
                <TableHead>车牌</TableHead>
                <TableHead>司机</TableHead>
                <TableHead>市场</TableHead>
                <TableHead className="text-right">桶数 Crates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dispatchOrders.map((o) => (
                <TableRow
                  key={o.id}
                  className={selectedId === o.id ? "bg-haidee-accent/10" : ""}
                  onClick={() => setSelectedId(o.id)}
                >
                  <TableCell>
                    <input
                      type="radio"
                      name="dispatch"
                      checked={selectedId === o.id}
                      onChange={() => setSelectedId(o.id)}
                      className="h-4 w-4 accent-haidee-blue"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {o.dispatchNo}
                  </TableCell>
                  <TableCell className="font-mono">{o.doNumber}</TableCell>
                  <TableCell className="font-mono">{o.truckPlate}</TableCell>
                  <TableCell>{o.driverName ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {o.markets.map((m) => (
                        <MarketLabel key={m} code={m} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {o.totalQty}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* D/O generation buttons */}
      <div className="space-y-3 rounded-xl border border-haidee-border bg-white p-4">
        <h3 className="font-semibold text-haidee-text">
          派车单文件 Dispatch D/O
        </h3>
        <p className="text-xs text-haidee-muted">
          先选择上方派车单，再生成 D/O Select a dispatch order above
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => openInternalDO(false)}
            disabled={!selectedId}
            className="min-h-[44px] gap-2 bg-haidee-blue text-white hover:bg-haidee-blue/90"
          >
            <FileText className="h-4 w-4" />
            生成内部 D/O Internal
          </Button>
          <Button
            onClick={() => openInternalDO(true)}
            disabled={!selectedId}
            variant="outline"
            className="min-h-[44px] gap-2"
          >
            <FileText className="h-4 w-4" />
            生成外部 D/O External
          </Button>
        </div>
      </div>

      {/* Market D/O multi-select */}
      <div className="space-y-3 rounded-xl border border-haidee-border bg-white p-4">
        <h3 className="font-semibold text-haidee-text">
          市场 D/O Market D/O
        </h3>
        <p className="text-xs text-haidee-muted">
          勾选多个市场合并生成一份 D/O Select markets to merge into one D/O
        </p>
        <div className="flex flex-wrap gap-3">
          {MARKET_ORDER.map((code) => (
            <label
              key={code}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-haidee-border px-3 py-2 hover:bg-haidee-surface/60"
            >
              <input
                type="checkbox"
                checked={selectedMarkets.includes(code)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedMarkets([...selectedMarkets, code]);
                  } else {
                    setSelectedMarkets(
                      selectedMarkets.filter((m) => m !== code)
                    );
                  }
                }}
                className="h-4 w-4 accent-haidee-blue"
              />
              <MarketLabel code={code} />
            </label>
          ))}
        </div>
        <Button
          onClick={openMarketDO}
          disabled={selectedMarkets.length === 0}
          className="min-h-[44px] gap-2 bg-haidee-blue text-white hover:bg-haidee-blue/90"
        >
          <FileText className="h-4 w-4" />
          生成选中市场 D/O ({selectedMarkets.length}个市场)
          <span className="text-haidee-muted/80">Generate Selected Markets D/O</span>
        </Button>
      </div>

      {/* Crate by type */}
      <div className="space-y-3 rounded-xl border border-haidee-border bg-white p-4">
        <h3 className="font-semibold text-haidee-text">
          桶型记录 Crate by Type
        </h3>
        {marketTongCombos.length === 0 ? (
          <p className="text-sm text-haidee-muted">当日无已分配货物</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {marketTongCombos.map((c) => {
                const key = `${c.marketCode}:${c.tongCode}`;
                return (
                  <label
                    key={key}
                    className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-haidee-border px-3 py-2 hover:bg-haidee-surface/60"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCombos.has(key)}
                      onChange={() => toggleCombo(key)}
                      className="h-4 w-4 accent-haidee-blue"
                    />
                    <MarketLabel code={c.marketCode} />
                    <span className="font-mono text-sm">{c.tongHeader}</span>
                    <span className="ml-auto font-mono text-sm text-haidee-muted">
                      {c.quantity}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {marketTongCombos.map((c) => (
                <Button
                  key={`${c.marketCode}:${c.tongCode}`}
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => openCrateByType(c.marketCode, c.tongCode)}
                  className="gap-1"
                >
                  <Package className="h-3 w-3" />
                  {c.marketCode}/{c.tongHeader}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>

      <PrintPreviewDialog
        open={cratePreview !== null}
        onClose={() => setCratePreview(null)}
        title={cratePreviewTitle}
        documentTitle={crateDocTitle}
      >
        {cratePreview && <CrateByTypePrint data={cratePreview} />}
      </PrintPreviewDialog>
    </div>
  );
}

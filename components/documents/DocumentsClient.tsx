"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInputField } from "@/components/shared/DateInputField";
import { CrateByTypePicker } from "@/components/documents/CrateByTypePicker";
import { MARKET_ORDER } from "@/lib/markets";
import { cn } from "@/lib/utils";
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
  const [selectedId, setSelectedId] = useState<string>(
    dispatchOrders[0]?.id ?? ""
  );
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

  function toggleCombo(key: string) {
    setSelectedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openCratePrint() {
    if (selectedCombos.size === 0) return;
    const params = new URLSearchParams();
    params.set("date", date);
    params.set("selections", Array.from(selectedCombos).join(","));
    router.push(`/documents/crate-by-type?${params.toString()}`);
  }

  return (
    <div
      className={cn(
        "space-y-6",
        selectedCombos.size > 0 && "pb-24"
      )}
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">
            日期 Date
          </label>
          <DateInputField value={date} onChange={changeDate} />
        </div>
      </div>

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
            className="min-h-[44px] gap-2 bg-haidee-blue text-white hover:bg-haidee-blue/90"
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
        <p className="text-xs text-haidee-muted">
          按桶型分列勾选市场，可跨桶型多选后打印统计单
        </p>
        <CrateByTypePicker
          combos={marketTongCombos}
          selectedKeys={selectedCombos}
          onToggle={toggleCombo}
          onPrint={openCratePrint}
        />
      </div>
    </div>
  );
}

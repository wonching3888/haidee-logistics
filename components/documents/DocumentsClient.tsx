"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Printer } from "lucide-react";
import type { CrateTypeRecordOptions } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { DateInputField } from "@/components/shared/DateInputField";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { stickyFirstColTableClass } from "@/lib/table-scroll";
import { CrateByTypePicker } from "@/components/documents/CrateByTypePicker";
import { CrateTypeRecordPicker } from "@/components/documents/CrateTypeRecordPicker";
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

const DOCUMENT_ACTION_BTN =
  "min-h-[44px] gap-2 px-5 text-sm font-medium bg-haidee-blue text-white hover:bg-haidee-blue/90 disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-100 disabled:hover:bg-gray-300";

function MarketLabel({ code }: { code: string }) {
  return <span className={marketLabelClass}>{code}</span>;
}

function ModuleCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-haidee-border bg-white shadow-sm">
      <header className="border-b border-haidee-border bg-haidee-surface/40 px-4 py-3">
        <h3 className="font-semibold text-haidee-text">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

interface DocumentsClientProps {
  date: string;
  dispatchOrders: DispatchOrderRow[];
  marketTongCombos: MarketTongCombo[];
  crateTypeRecordOptions: CrateTypeRecordOptions;
}

export function DocumentsClient({
  date,
  dispatchOrders,
  marketTongCombos,
  crateTypeRecordOptions,
}: DocumentsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string>(
    dispatchOrders[0]?.id ?? ""
  );
  const [selectedCombos, setSelectedCombos] = useState<Set<string>>(new Set());
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [recordMarkets, setRecordMarkets] = useState<string[]>([]);
  const [recordTongCodes, setRecordTongCodes] = useState<string[]>([]);

  const hasCrateTypeRecord = crateTypeRecordOptions.markets.length > 0;

  useEffect(() => {
    setRecordMarkets([]);
    setRecordTongCodes([]);
  }, [crateTypeRecordOptions]);

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

  function openCrateTypeRecord() {
    if (recordMarkets.length === 0 || recordTongCodes.length === 0) return;
    const params = new URLSearchParams();
    params.set("date", date);
    params.set("markets", recordMarkets.join(","));
    params.set("tongTypes", recordTongCodes.join(","));
    router.push(`/documents/crate-type-record?${params.toString()}`);
  }

  function toggleRecordMarket(code: string) {
    setRecordMarkets((prev) =>
      prev.includes(code) ? prev.filter((m) => m !== code) : [...prev, code]
    );
  }

  function toggleRecordTongCode(code: string) {
    setRecordTongCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

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

      {/* Module 1: Dispatch Orders */}
      <ModuleCard title="当日派车单 Dispatch Orders">
        {dispatchOrders.length === 0 ? (
          <p className="py-6 text-center text-haidee-muted">
            当日暂无派车单 No dispatch orders for this date
          </p>
        ) : (
          <ScrollMatrixTable heightOffset={360}>
            <Table noScrollContainer className={stickyFirstColTableClass}>
              <TableHeader>
                <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                  <TableHead className="w-10" />
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
                    className={
                      selectedId === o.id ? "bg-haidee-accent/10" : ""
                    }
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
                      <div className="flex flex-wrap gap-1">
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
          </ScrollMatrixTable>
        )}

        <div className="mt-4 flex flex-wrap gap-3 border-t border-haidee-border pt-4">
          <Button
            onClick={() => openInternalDO(false)}
            disabled={!selectedId}
            className={DOCUMENT_ACTION_BTN}
          >
            <FileText className="h-4 w-4" />
            生成内部 D/O Internal
          </Button>
          <Button
            onClick={() => openInternalDO(true)}
            disabled={!selectedId}
            className={DOCUMENT_ACTION_BTN}
          >
            <FileText className="h-4 w-4" />
            生成外部 D/O External
          </Button>
        </div>
      </ModuleCard>

      {/* Module 2: Market D/O */}
      <ModuleCard title="市场 D/O Market D/O">
        <p className="mb-3 text-xs text-haidee-muted">
          勾选多个市场合并生成一份 D/O Select markets to merge into one D/O
        </p>
        <div className="mb-4 flex flex-wrap gap-3">
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
          className={DOCUMENT_ACTION_BTN}
        >
          <FileText className="h-4 w-4" />
          生成选中市场 D/O
        </Button>
      </ModuleCard>

      {/* Module 3: Crate by Type */}
      <ModuleCard title="桶型记录 Crate by Type">
        <p className="mb-3 text-xs text-haidee-muted">
          按桶型分列勾选市场，可跨桶型多选后打印统计单
        </p>
        <CrateByTypePicker
          combos={marketTongCombos}
          selectedKeys={selectedCombos}
          onToggle={toggleCombo}
        />
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-haidee-border pt-4">
          <Button
            onClick={openCratePrint}
            disabled={selectedCombos.size === 0}
            className={DOCUMENT_ACTION_BTN}
          >
            <Printer className="h-4 w-4" />
            打印统计单 Print
          </Button>
          <span className="text-sm text-haidee-muted">
            已选 {selectedCombos.size} 组
          </span>
        </div>
      </ModuleCard>

      {/* Module 4: Crate Type Record */}
      <ModuleCard title="桶型总计 Crate Type Record">
        <p className="mb-3 text-xs text-haidee-muted">
          勾选目的市场与桶型，按地区与车牌汇总打印总计表
        </p>
        {!hasCrateTypeRecord ? (
          <p className="py-4 text-center text-sm text-haidee-muted">
            当日暂无派车货物 No dispatched cargo for this date
          </p>
        ) : (
          <CrateTypeRecordPicker
            markets={crateTypeRecordOptions.markets}
            crateTypes={crateTypeRecordOptions.crateTypes}
            selectedMarkets={recordMarkets}
            selectedTongCodes={recordTongCodes}
            onToggleMarket={toggleRecordMarket}
            onToggleTongCode={toggleRecordTongCode}
            onSelectAllMarkets={(selectAll) =>
              setRecordMarkets(
                selectAll ? [...crateTypeRecordOptions.markets] : []
              )
            }
            onSelectAllTongCodes={(selectAll) =>
              setRecordTongCodes(
                selectAll
                  ? crateTypeRecordOptions.crateTypes.map(
                      (crateType) => crateType.code
                    )
                  : []
              )
            }
          />
        )}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-haidee-border pt-4">
          <Button
            onClick={openCrateTypeRecord}
            disabled={
              !hasCrateTypeRecord ||
              recordMarkets.length === 0 ||
              recordTongCodes.length === 0
            }
            className={DOCUMENT_ACTION_BTN}
          >
            <Printer className="h-4 w-4" />
            打印总计表 Print
          </Button>
        </div>
      </ModuleCard>
    </div>
  );
}

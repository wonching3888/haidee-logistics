"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DateInputField } from "@/components/shared/DateInputField";
import { formatDisplayDate } from "@/lib/date-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
interface StockRow {
  code: string;
  name: string;
  stock: number;
  todayIn: number;
  todayOut: number;
  shortage: number;
}

interface ShortageRow {
  shipperName: string;
  tongCode: string;
  tongName: string;
  shortage: number;
  date: Date;
  exportNo: string | null;
}

interface LedgerRow {
  date: string;
  type: "IN" | "OUT";
  plate: string;
  party: string;
  tongCode: string;
  quantity: number;
  signedQty: string;
  balance: number;
}

interface TongStockViewProps {
  stockRows: StockRow[];
  shortages: ShortageRow[];
  ledger: LedgerRow[];
  filterDate: string;
  displayDate: string;
}

export function TongStockView({
  stockRows,
  shortages,
  ledger,
  filterDate,
  displayDate,
}: TongStockViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="space-y-8">
      {/* Stock overview */}
      <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
        <div className="border-b border-haidee-border px-4 py-3">
          <h3 className="font-semibold text-haidee-text">
            SADAO 实时库存 SADAO Stock
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>桶型 Crate Type</TableHead>
              <TableHead className="text-right">SADAO库存 Stock</TableHead>
              <TableHead className="text-right">今日 IN</TableHead>
              <TableHead className="text-right">今日 OUT</TableHead>
              <TableHead className="text-right">欠桶 Shortage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockRows.map((row) => (
              <TableRow key={row.code}>
                <TableCell>
                  <span className="font-mono font-semibold">{row.code}</span>
                  <span className="ml-2 text-haidee-muted">{row.name}</span>
                </TableCell>
                <TableCell className="text-right font-mono text-lg font-bold text-haidee-navy">
                  {row.stock.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-haidee-green">
                  {row.todayIn > 0 ? `+${row.todayIn}` : "0"}
                </TableCell>
                <TableCell className="text-right font-mono text-haidee-red">
                  {row.todayOut > 0 ? `-${row.todayOut}` : "0"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {row.shortage > 0 ? (
                    <span className="font-semibold text-haidee-red">
                      {row.shortage}桶
                    </span>
                  ) : (
                    "0"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Shortage details */}
      {shortages.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
          <div className="border-b border-haidee-border px-4 py-3">
            <h3 className="font-semibold text-haidee-text">
              欠桶记录 Shortage Records
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>寄货人 Consignor</TableHead>
                <TableHead>桶型 Crate Type</TableHead>
                <TableHead className="text-right">欠桶数 Qty</TableHead>
                <TableHead>日期 Date</TableHead>
                <TableHead>收据 No.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shortages.map((s, i) => (
                <TableRow key={i}>
                  <TableCell>{s.shipperName}</TableCell>
                  <TableCell className="font-mono">
                    {s.tongCode} — {s.tongName}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-haidee-red">
                    {s.shortage}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatDisplayDate(new Date(s.date))}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {s.exportNo ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Ledger */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <h3 className="font-semibold text-haidee-text">
            每日流水 Ledger
          </h3>
          <div className="space-y-1">
            <label className="text-xs text-haidee-muted">
              筛选日期 Filter
            </label>
            <DateInputField
              value={filterDate}
              inputClassName="min-h-[40px]"
              onChange={(next) => {
                const params = new URLSearchParams(searchParams.toString());
                if (next) params.set("date", next);
                else params.delete("date");
                router.push(`/tong/stock?${params.toString()}`);
              }}
            />
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
          {ledger.length === 0 ? (
            <p className="p-8 text-center text-haidee-muted">暂无流水记录</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                  <TableHead>日期 Date</TableHead>
                  <TableHead>类型 Type</TableHead>
                  <TableHead>车牌 Plate</TableHead>
                  <TableHead>市场/寄货人 Party</TableHead>
                  <TableHead>桶型 Crate Type</TableHead>
                  <TableHead className="text-right">数量 Qty</TableHead>
                  <TableHead className="text-right">余额 Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{e.date}</TableCell>
                    <TableCell>
                      <span
                        className={
                          e.type === "IN"
                            ? "font-semibold text-haidee-green"
                            : "font-semibold text-haidee-red"
                        }
                      >
                        {e.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono">{e.plate}</TableCell>
                    <TableCell>{e.party}</TableCell>
                    <TableCell className="font-mono">{e.tongCode}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {e.signedQty}
                    </TableCell>
                    <TableCell className="text-right font-mono text-haidee-muted">
                      {e.balance}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}

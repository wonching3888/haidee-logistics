"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TONG_IMPORT_COLUMNS } from "@/lib/constants/tong-import-columns";
import { markImportsArrived, saveTongImport } from "@/app/actions/tong";
import { toDateInputValue } from "@/lib/inbound-utils";

interface TruckOption {
  id: string;
  plate: string;
}

interface MarketOption {
  id: string;
  code: string;
  name: string;
}

interface ImportRow {
  id: string;
  truckPlate: string;
  marketCode: string;
  quantities: Record<string, string>;
  notes: string;
  status: "on_the_way" | "arrived";
}

function emptyRow(): ImportRow {
  return {
    id: crypto.randomUUID(),
    truckPlate: "",
    marketCode: "",
    quantities: Object.fromEntries(TONG_IMPORT_COLUMNS.map((c) => [c.key, ""])),
    notes: "",
    status: "on_the_way",
  };
}

function rowTotal(row: ImportRow): number {
  return TONG_IMPORT_COLUMNS.reduce(
    (sum, col) => sum + (parseInt(row.quantities[col.key] ?? "0", 10) || 0),
    0
  );
}

interface TongImportFormProps {
  trucks: TruckOption[];
  markets: MarketOption[];
}

export function TongImportForm({ trucks, markets }: TongImportFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(toDateInputValue(new Date()));
  const [rows, setRows] = useState<ImportRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "on_the_way" | "arrived">("all");

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of TONG_IMPORT_COLUMNS) totals[col.key] = 0;
    for (const row of rows) {
      for (const col of TONG_IMPORT_COLUMNS) {
        totals[col.key] += parseInt(row.quantities[col.key] ?? "0", 10) || 0;
      }
    }
    return totals;
  }, [rows]);

  const grandTotal = Object.values(columnTotals).reduce((a, b) => a + b, 0);

  function updateRow(id: string, patch: Partial<ImportRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function updateQty(id: string, key: string, value: string) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, quantities: { ...r.quantities, [key]: value } }
          : r
      )
    );
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await saveTongImport(
          date,
          rows.map((r) => ({
            truckPlate: r.truckPlate,
            marketCode: r.marketCode,
            quantities: r.quantities,
            notes: r.notes || undefined,
            status: r.status,
          }))
        );
        setSuccess(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">日期 Date</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-[44px] w-auto"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">状态筛选 Filter</label>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="min-h-[44px] rounded-lg border border-haidee-border px-3 text-sm"
          >
            <option value="all">全部 All</option>
            <option value="on_the_way">在途 On The Way</option>
            <option value="arrived">已到 Arrived</option>
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            startTransition(async () => {
              await markImportsArrived(date);
              setRows((prev) =>
                prev.map((r) => ({ ...r, status: "arrived" as const }))
              );
              router.refresh();
            })
          }
          disabled={isPending}
        >
          确认到达 Mark Arrived
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
                <th className="px-2 py-2">序号 No.</th>
                <th className="px-2 py-2">车牌 Plate</th>
                <th className="px-2 py-2">来源市场 Market</th>
                {TONG_IMPORT_COLUMNS.map((c) => (
                  <th key={c.key} className="px-1 py-2 font-mono">
                    {c.label}
                  </th>
                ))}
                <th className="px-2 py-2">总计 Total</th>
                <th className="px-2 py-2">状态 Status</th>
                <th className="px-2 py-2">备注 Notes</th>
                <th className="px-1 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter(
                  (row) =>
                    statusFilter === "all" || row.status === statusFilter
                )
                .map((row, idx) => (
                <tr
                  key={row.id}
                  className={`border-b border-haidee-border/60 ${
                    row.status === "on_the_way" ? "bg-yellow-50/80" : ""
                  }`}
                >
                  <td className="px-2 py-1 text-center font-mono">{idx + 1}</td>
                  <td className="px-1 py-1">
                    <select
                      value={row.truckPlate}
                      onChange={(e) =>
                        updateRow(row.id, { truckPlate: e.target.value })
                      }
                      className="min-h-[40px] w-full min-w-[100px] rounded border border-haidee-border px-1 font-mono text-xs"
                    >
                      <option value="">—</option>
                      {trucks.map((t) => (
                        <option key={t.id} value={t.plate}>
                          {t.plate}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={row.marketCode}
                      onChange={(e) =>
                        updateRow(row.id, { marketCode: e.target.value })
                      }
                      className="min-h-[40px] w-full min-w-[72px] rounded border border-haidee-border px-1 font-mono text-xs"
                    >
                      <option value="">—</option>
                      <option value="X">X</option>
                      {markets.map((m) => (
                        <option key={m.id} value={m.code}>
                          {m.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  {TONG_IMPORT_COLUMNS.map((col) => (
                    <td key={col.key} className="px-1 py-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.quantities[col.key]}
                        onChange={(e) => updateQty(row.id, col.key, e.target.value)}
                        disabled={row.marketCode === "X"}
                        className="min-h-[40px] w-12 rounded border border-haidee-border px-1 text-center font-mono text-sm disabled:bg-haidee-surface"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center font-mono font-semibold">
                    {rowTotal(row)}
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={row.status}
                      onChange={(e) =>
                        updateRow(row.id, {
                          status: e.target.value as ImportRow["status"],
                        })
                      }
                      className="min-h-[40px] w-full min-w-[90px] rounded border border-haidee-border px-1 text-xs"
                    >
                      <option value="on_the_way">🟡 在途</option>
                      <option value="arrived">🟢 已到</option>
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) =>
                        updateRow(row.id, { notes: e.target.value })
                      }
                      className="min-h-[40px] w-full min-w-[80px] rounded border border-haidee-border px-1 text-xs"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() =>
                        setRows((prev) => prev.filter((r) => r.id !== row.id))
                      }
                      className="rounded p-1 text-haidee-muted hover:text-haidee-red"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setRows((prev) => [...prev, emptyRow()])}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        加一行 Add Row
      </Button>

      <div className="rounded-xl border border-haidee-border bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-haidee-text">
          各桶型总计 Column Totals
        </h3>
        <div className="flex flex-wrap gap-3 text-sm">
          {TONG_IMPORT_COLUMNS.map((col) => (
            <span key={col.key} className="font-mono">
              {col.label}:{" "}
              <strong>{columnTotals[col.key]}</strong>
            </span>
          ))}
          <span className="ml-auto font-mono font-bold text-haidee-navy">
            总计 Total: {grandTotal}
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-haidee-green">
          保存成功，SADAO 库存已更新 Saved — SADAO stock updated
        </p>
      )}

      <Button
        onClick={handleSave}
        disabled={isPending}
        className="min-h-[44px] bg-haidee-blue text-white hover:bg-haidee-blue/90"
      >
        {isPending ? "保存中…" : "确认保存 Confirm Save"}
      </Button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import {
  loadCrateImportsForDate,
  markImportsArrived,
  saveTongImport,
} from "@/app/actions/tong";
import type { CrateImportLoadedRow } from "@/app/actions/crateImport";
import { DateInputField } from "@/components/shared/DateInputField";
import { Button } from "@/components/ui/button";
import { sortTrucksForImport } from "@/lib/constants/import-markets";
import {
  isDefaultImportColumn,
  TONG_IMPORT_DEFAULT_COLUMNS,
} from "@/lib/constants/tong-import-columns";

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

function emptyQuantities(): Record<string, string> {
  return Object.fromEntries(
    TONG_IMPORT_DEFAULT_COLUMNS.map((c) => [c.key, ""])
  );
}

function emptyRow(): ImportRow {
  return {
    id: crypto.randomUUID(),
    truckPlate: "",
    marketCode: "",
    quantities: emptyQuantities(),
    notes: "",
    status: "on_the_way",
  };
}

function rowFromLoaded(row: CrateImportLoadedRow): ImportRow {
  return {
    id: crypto.randomUUID(),
    truckPlate: row.truckPlate,
    marketCode: row.marketCode,
    quantities: { ...emptyQuantities(), ...row.quantities },
    notes: row.notes,
    status: row.status,
  };
}

function parseQty(value: string | undefined): number {
  return parseInt(value ?? "0", 10) || 0;
}

function rowTotal(row: ImportRow, dynamicColumns: string[]): number {
  let sum = 0;
  for (const col of TONG_IMPORT_DEFAULT_COLUMNS) {
    sum += parseQty(row.quantities[col.key]);
  }
  for (const name of dynamicColumns) {
    sum += parseQty(row.quantities[name]);
  }
  return sum;
}

interface TongImportFormProps {
  allTrucks: TruckOption[];
  markets: MarketOption[];
  initialDate: string;
  initialRows: CrateImportLoadedRow[];
  initialDynamicColumns: string[];
  initialDispatchedPlates: string[];
}

export function TongImportForm({
  allTrucks,
  markets,
  initialDate,
  initialRows,
  initialDynamicColumns,
  initialDispatchedPlates,
}: TongImportFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(initialDate);
  const [dispatchedPlates, setDispatchedPlates] = useState(
    initialDispatchedPlates
  );
  const [dynamicColumns, setDynamicColumns] = useState(initialDynamicColumns);
  const [rows, setRows] = useState<ImportRow[]>(() =>
    initialRows.length > 0 ? initialRows.map(rowFromLoaded) : [emptyRow()]
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "on_the_way" | "arrived"
  >("all");

  const trucks = useMemo(
    () => sortTrucksForImport(allTrucks, dispatchedPlates),
    [allTrucks, dispatchedPlates]
  );

  const isFirstDateEffect = useRef(true);

  useEffect(() => {
    if (isFirstDateEffect.current) {
      isFirstDateEffect.current = false;
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      try {
        const data = await loadCrateImportsForDate(date);
        if (cancelled) return;

        setDispatchedPlates(data.dispatchedPlates);
        setDynamicColumns(data.dynamicColumns);
        setRows(
          data.rows.length > 0 ? data.rows.map(rowFromLoaded) : [emptyRow()]
        );
        setError(null);
        setSuccess(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败 Load failed");
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [date]);

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) => statusFilter === "all" || row.status === statusFilter
      ),
    [rows, statusFilter]
  );

  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of TONG_IMPORT_DEFAULT_COLUMNS) totals[col.key] = 0;
    for (const name of dynamicColumns) totals[name] = 0;

    for (const row of rows) {
      for (const col of TONG_IMPORT_DEFAULT_COLUMNS) {
        totals[col.key] += parseQty(row.quantities[col.key]);
      }
      for (const name of dynamicColumns) {
        totals[name] += parseQty(row.quantities[name]);
      }
    }

    return totals;
  }, [rows, dynamicColumns]);

  const grandTotal = useMemo(
    () => Object.values(columnTotals).reduce((a, b) => a + b, 0),
    [columnTotals]
  );

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

  function addDynamicColumn() {
    const name = prompt("输入列名称\nEnter column name");
    if (!name?.trim()) return;
    const colName = name.trim().toUpperCase();
    if (isDefaultImportColumn(colName)) {
      setError(`${colName} 已是默认列 Already a default column`);
      return;
    }
    if (dynamicColumns.includes(colName)) {
      setError(`列名已存在 Column already exists: ${colName}`);
      return;
    }
    setDynamicColumns((prev) => [...prev, colName]);
    setError(null);
  }

  function removeDynamicColumn(colName: string) {
    setDynamicColumns((prev) => prev.filter((c) => c !== colName));
    setRows((prev) =>
      prev.map((r) => {
        const rest = { ...r.quantities };
        delete rest[colName];
        return { ...r, quantities: rest };
      })
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
          <label className="text-sm font-medium text-haidee-text">
            日期 Date
          </label>
          <DateInputField value={date} onChange={setDate} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">
            状态筛选 Filter
          </label>
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
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
                <th className="px-2 py-2 text-left">车牌 Plate</th>
                <th className="px-2 py-2 text-left">来源市场 Market</th>
                {TONG_IMPORT_DEFAULT_COLUMNS.map((c) => (
                  <th key={c.key} className="px-1 py-2 font-mono">
                    {c.label}
                  </th>
                ))}
                {dynamicColumns.map((name) => (
                  <th key={name} className="px-1 py-2 font-mono">
                    <span className="inline-flex items-center gap-1">
                      {name}
                      <button
                        type="button"
                        onClick={() => removeDynamicColumn(name)}
                        className="rounded p-0.5 text-haidee-muted hover:text-haidee-red"
                        aria-label={`删除列 ${name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </th>
                ))}
                <th className="px-1 py-2">
                  <button
                    type="button"
                    onClick={addDynamicColumn}
                    className="inline-flex items-center gap-0.5 rounded border border-dashed border-haidee-border px-1.5 py-0.5 font-medium text-haidee-blue hover:bg-haidee-surface"
                  >
                    <Plus className="h-3 w-3" />
                    加列
                  </button>
                </th>
                <th className="px-2 py-2">状态 Status</th>
                <th className="px-2 py-2">备注 Notes</th>
                <th className="px-2 py-2">总计 Total</th>
                <th className="px-1 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-haidee-border/60 ${
                    row.status === "on_the_way" ? "bg-yellow-50/80" : ""
                  }`}
                >
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
                      {markets.map((m) => (
                        <option key={m.id} value={m.code}>
                          {m.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  {TONG_IMPORT_DEFAULT_COLUMNS.map((col) => (
                    <td key={col.key} className="px-1 py-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.quantities[col.key] ?? ""}
                        onChange={(e) =>
                          updateQty(row.id, col.key, e.target.value)
                        }
                        className="min-h-[40px] w-12 rounded border border-haidee-border px-1 text-center font-mono text-sm"
                      />
                    </td>
                  ))}
                  {dynamicColumns.map((name) => (
                    <td key={name} className="px-1 py-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.quantities[name] ?? ""}
                        onChange={(e) =>
                          updateQty(row.id, name, e.target.value)
                        }
                        className="min-h-[40px] w-12 rounded border border-haidee-border px-1 text-center font-mono text-sm"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1" />
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
                  <td className="px-2 py-1 text-center font-mono font-semibold">
                    {rowTotal(row, dynamicColumns) || ""}
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
            <tfoot>
              <tr className="border-t-2 border-haidee-border bg-haidee-surface font-semibold text-haidee-text">
                <td className="px-2 py-2" colSpan={2}>
                  总计 Total
                </td>
                {TONG_IMPORT_DEFAULT_COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className="px-1 py-2 text-center font-mono"
                  >
                    {columnTotals[col.key] || ""}
                  </td>
                ))}
                {dynamicColumns.map((name) => (
                  <td key={name} className="px-1 py-2 text-center font-mono">
                    {columnTotals[name] || ""}
                  </td>
                ))}
                <td className="px-1 py-2" />
                <td className="px-1 py-2" colSpan={2} />
                <td className="px-2 py-2 text-center font-mono font-bold">
                  {grandTotal || ""}
                </td>
                <td className="px-1 py-2" />
              </tr>
            </tfoot>
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

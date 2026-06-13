"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import {
  loadCrateImportsForDate,
  loadInTransitCrateImports,
  markCrateImportRowArrived,
  saveTongImport,
} from "@/app/actions/tong";
import { DateInputField } from "@/components/shared/DateInputField";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import type {
  CrateImportLoadedRow,
  CrateTypeOption,
  InTransitImportRow,
} from "@/app/actions/crateImport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sortTrucksForImport } from "@/lib/constants/import-markets";
import {
  CRATE_IMPORT_OTHER_COLUMN,
  TONG_IMPORT_DEFAULT_COLUMNS,
} from "@/lib/constants/tong-import-columns";
import {
  STICKY_BODY_FIRST,
  STICKY_HEAD_FIRST,
  STICKY_HEAD_TOP,
} from "@/lib/table-scroll";
import { cn } from "@/lib/utils";

interface TruckOption {
  id: string;
  plate: string;
}

interface MarketOption {
  id: string;
  code: string;
  name: string;
  displayName?: string;
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

function rowTotal(
  quantities: Record<string, string>,
  dynamicColumns: string[]
): number {
  let sum = 0;
  for (const col of TONG_IMPORT_DEFAULT_COLUMNS) {
    sum += parseQty(quantities[col.key]);
  }
  for (const name of dynamicColumns) {
    sum += parseQty(quantities[name]);
  }
  return sum;
}

function mergeDynamicColumns(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of lists) {
    for (const col of list) {
      if (!seen.has(col)) {
        seen.add(col);
        merged.push(col);
      }
    }
  }
  return merged;
}

interface TongImportFormProps {
  allTrucks: TruckOption[];
  markets: MarketOption[];
  crateTypes: CrateTypeOption[];
  initialDate: string;
  initialRows: CrateImportLoadedRow[];
  initialDynamicColumns: string[];
  initialDispatchedPlates: string[];
  initialInTransitRows: InTransitImportRow[];
  initialInTransitDynamicColumns: string[];
}

export function TongImportForm({
  allTrucks,
  markets,
  crateTypes,
  initialDate,
  initialRows,
  initialDynamicColumns,
  initialDispatchedPlates,
  initialInTransitRows,
  initialInTransitDynamicColumns,
}: TongImportFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const [dispatchedPlates, setDispatchedPlates] = useState(
    initialDispatchedPlates
  );
  const [dynamicColumns, setDynamicColumns] = useState(initialDynamicColumns);
  const [rows, setRows] = useState<ImportRow[]>(() =>
    initialRows.length > 0 ? initialRows.map(rowFromLoaded) : [emptyRow()]
  );
  const [inTransitRows, setInTransitRows] = useState(initialInTransitRows);
  const [inTransitDynamicColumns, setInTransitDynamicColumns] = useState(
    initialInTransitDynamicColumns
  );

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [selectedColumnCode, setSelectedColumnCode] = useState("");

  const isFirstDateEffect = useRef(true);

  useEffect(() => {
    if (isFirstDateEffect.current) {
      isFirstDateEffect.current = false;
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      try {
        const data = await loadCrateImportsForDate(selectedDate);
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
  }, [selectedDate]);

  const trucks = useMemo(
    () => sortTrucksForImport(allTrucks, dispatchedPlates),
    [allTrucks, dispatchedPlates]
  );

  const allDynamicColumns = useMemo(
    () => mergeDynamicColumns(dynamicColumns, inTransitDynamicColumns),
    [dynamicColumns, inTransitDynamicColumns]
  );

  const inTransitTruckCount = useMemo(
    () => new Set(inTransitRows.map((r) => r.truckPlate)).size,
    [inTransitRows]
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

  const usedColumnCodes = useMemo(() => {
    const codes = new Set<string>(
      TONG_IMPORT_DEFAULT_COLUMNS.map((c) => c.key)
    );
    for (const code of dynamicColumns) codes.add(code);
    return codes;
  }, [dynamicColumns]);

  const addableColumnOptions = useMemo(() => {
    const options = crateTypes
      .filter((t) => !usedColumnCodes.has(t.code))
      .map((t) => ({
        code: t.code,
        label: t.code,
        hint: t.name !== t.code ? t.name : undefined,
      }));

    if (!usedColumnCodes.has(CRATE_IMPORT_OTHER_COLUMN)) {
      options.push({
        code: CRATE_IMPORT_OTHER_COLUMN,
        label: CRATE_IMPORT_OTHER_COLUMN,
        hint: "备注，不计入库存 Notes only",
      });
    }

    return options;
  }, [crateTypes, usedColumnCodes]);

  async function refreshInTransit() {
    const data = await loadInTransitCrateImports();
    setInTransitRows(data.rows);
    setInTransitDynamicColumns(data.dynamicColumns);
  }

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

  function openAddColumnDialog() {
    if (addableColumnOptions.length === 0) {
      setError("没有可添加的桶型 No more crate types to add");
      return;
    }
    setSelectedColumnCode(addableColumnOptions[0]?.code ?? "");
    setAddColumnOpen(true);
    setError(null);
  }

  function confirmAddColumn() {
    if (!selectedColumnCode) return;
    if (usedColumnCodes.has(selectedColumnCode)) {
      setError(`列已存在 Column already exists: ${selectedColumnCode}`);
      return;
    }
    setDynamicColumns((prev) => [...prev, selectedColumnCode]);
    setAddColumnOpen(false);
    setSelectedColumnCode("");
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

  function handleSaveToday() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await saveTongImport(
          selectedDate,
          rows.map((r) => ({
            truckPlate: r.truckPlate,
            marketCode: r.marketCode,
            quantities: r.quantities,
            notes: r.notes || undefined,
            status: r.status,
          }))
        );
        await refreshInTransit();
        setSuccess(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function handleInTransitStatusChange(
    row: InTransitImportRow,
    status: "on_the_way" | "arrived"
  ) {
    if (status !== "arrived") return;

    setError(null);
    startTransition(async () => {
      try {
        await markCrateImportRowArrived(
          row.dateInput,
          row.truckPlate,
          row.marketCode
        );
        setInTransitRows((prev) =>
          prev.filter(
            (r) =>
              !(
                r.dateInput === row.dateInput &&
                r.truckPlate === row.truckPlate &&
                r.marketCode === row.marketCode
              )
          )
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "更新失败 Update failed");
      }
    });
  }

  const inputClass =
    "min-h-[40px] rounded border border-haidee-border px-1 text-center font-mono text-sm";
  const selectClass =
    "min-h-[40px] w-full rounded border border-haidee-border px-1 font-mono text-xs";

  return (
    <div className="space-y-8">
      {/* Daily records section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h3 className="text-lg font-semibold text-haidee-text">
            当日记录 Today
          </h3>
          <DateInputField
            value={selectedDate}
            onChange={setSelectedDate}
            className="w-[11.5rem] shrink-0"
          />
        </div>

        <ScrollMatrixTable heightOffset={320}>
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
                <th className={cn(STICKY_HEAD_FIRST, "px-2 py-2 text-left")}>车牌 Plate</th>
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
                      onClick={openAddColumnDialog}
                      disabled={addableColumnOptions.length === 0}
                      className="inline-flex items-center gap-0.5 rounded border border-dashed border-haidee-border px-1.5 py-0.5 font-medium text-haidee-blue hover:bg-haidee-surface disabled:cursor-not-allowed disabled:opacity-50"
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
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-haidee-border/60 ${
                      row.status === "on_the_way" ? "bg-yellow-50/80" : ""
                    }`}
                  >
                    <td className={cn(STICKY_BODY_FIRST, "px-1 py-1")}>
                      <select
                        value={row.truckPlate}
                        onChange={(e) =>
                          updateRow(row.id, { truckPlate: e.target.value })
                        }
                        className={`${selectClass} min-w-[100px]`}
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
                        className={`${selectClass} min-w-[72px]`}
                      >
                        <option value="">—</option>
                        {markets.map((m) => (
                          <option key={m.id} value={m.code}>
                            {m.code} — {m.displayName ?? m.name}
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
                          className={`${inputClass} w-12`}
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
                          className={`${inputClass} w-12`}
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
                        className={`${selectClass} min-w-[90px]`}
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
                        className={`${inputClass} w-full min-w-[80px] text-left`}
                      />
                    </td>
                    <td className="px-2 py-1 text-center font-mono font-semibold">
                      {rowTotal(row.quantities, dynamicColumns) || ""}
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
        </ScrollMatrixTable>

        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          加一行 Add Row
        </Button>

        <Button
          onClick={handleSaveToday}
          disabled={isPending}
          className="min-h-[44px] bg-haidee-blue text-white hover:bg-haidee-blue/90"
        >
          {isPending ? "保存中…" : "确认保存 Confirm Save"}
        </Button>
      </section>

      {/* In transit section */}
      {inTransitRows.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-haidee-text">
              仍在途中 In Transit
            </h3>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-haidee-orange">
              {inTransitTruckCount} 辆车仍在途中
            </span>
          </div>

          <ScrollMatrixTable heightOffset={320}>
              <table className="w-full min-w-[960px] text-xs">
                <thead>
                  <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
                    <th className={cn(STICKY_HEAD_FIRST, "px-2 py-2 text-left")}>车牌 Plate</th>
                    <th className={cn(STICKY_HEAD_TOP, "px-2 py-2 text-left")}>日期 Date</th>
                    <th className="px-2 py-2 text-left">来源市场 Market</th>
                    {TONG_IMPORT_DEFAULT_COLUMNS.map((c) => (
                      <th key={c.key} className="px-1 py-2 font-mono">
                        {c.label}
                      </th>
                    ))}
                    {allDynamicColumns.map((name) => (
                      <th key={name} className="px-1 py-2 font-mono">
                        {name}
                      </th>
                    ))}
                    <th className="px-2 py-2">状态 Status</th>
                    <th className="px-2 py-2">备注 Notes</th>
                    <th className="px-2 py-2">总计 Total</th>
                  </tr>
                </thead>
                <tbody>
                  {inTransitRows.map((row) => (
                    <tr
                      key={`${row.dateInput}-${row.truckPlate}-${row.marketCode}`}
                      className="border-b border-haidee-border/60 bg-yellow-50/80"
                    >
                      <td className={cn(STICKY_BODY_FIRST, "px-2 py-1 font-mono")}>{row.truckPlate}</td>
                      <td className="px-2 py-1 font-mono">{row.dateStr}</td>
                      <td className="px-2 py-1 font-mono">{row.marketCode}</td>
                      {TONG_IMPORT_DEFAULT_COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className="px-1 py-1 text-center font-mono"
                        >
                          {row.quantities[col.key] || ""}
                        </td>
                      ))}
                      {allDynamicColumns.map((name) => (
                        <td
                          key={name}
                          className="px-1 py-1 text-center font-mono"
                        >
                          {row.quantities[name] || ""}
                        </td>
                      ))}
                      <td className="px-1 py-1">
                        <select
                          value={row.status}
                          onChange={(e) =>
                            handleInTransitStatusChange(
                              row,
                              e.target.value as "on_the_way" | "arrived"
                            )
                          }
                          disabled={isPending}
                          className={`${selectClass} min-w-[90px]`}
                        >
                          <option value="on_the_way">🟡 在途</option>
                          <option value="arrived">🟢 已到</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 text-haidee-muted">
                        {row.notes || "—"}
                      </td>
                      <td className="px-2 py-1 text-center font-mono font-semibold">
                        {rowTotal(row.quantities, allDynamicColumns) || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </ScrollMatrixTable>
        </section>
      )}

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

      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加桶型列 Add Crate Column</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-haidee-text">
              选择桶型 Select crate type
            </label>
            <select
              value={selectedColumnCode}
              onChange={(e) => setSelectedColumnCode(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 font-mono text-sm"
            >
              {addableColumnOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                  {opt.hint ? ` — ${opt.hint}` : ""}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddColumnOpen(false)}
            >
              取消 Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmAddColumn}
              disabled={!selectedColumnCode}
              className="bg-haidee-blue text-white hover:bg-haidee-blue/90"
            >
              确认添加 Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

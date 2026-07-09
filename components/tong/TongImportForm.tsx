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
import { useT } from "@/components/shared/locale-context";
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
import {
  crateImportRowKey,
  deriveCrateImportRowState,
  parseCrateImportRowKey,
  type CrateImportRowState,
  shouldPersistCrateImportRow,
} from "@/lib/crate-import-rows";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n/messages";

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
  noReturn: boolean;
  awaitingQty?: boolean;
  persistedKey?: string;
}

function saveFeedbackClassName(savedCount: number, skippedCount: number) {
  if (savedCount > 0 && skippedCount === 0) {
    return "rounded-md bg-green-50 px-4 py-3 text-sm text-haidee-green";
  }
  return "rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900";
}

function SaveFeedback({
  error,
  success,
  saveMessage,
  savedCount,
  skippedCount,
  t,
}: {
  error: string | null;
  success: boolean;
  saveMessage: string | null;
  savedCount: number;
  skippedCount: number;
  t: (key: MessageKey, vars?: Record<string, string>) => string;
}) {
  if (error) {
    return (
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
        {error}
      </p>
    );
  }
  if (!success) return null;

  const message =
    saveMessage ??
    (savedCount > 0 || skippedCount > 0
      ? t("crateImport.saveResult", {
          saved: String(savedCount),
          skipped: String(skippedCount),
        })
      : t("crateImport.saveSuccess"));

  return (
    <p className={saveFeedbackClassName(savedCount, skippedCount)}>{message}</p>
  );
}

function rowStateLabel(
  state: CrateImportRowState,
  t: (key: MessageKey, vars?: Record<string, string>) => string
) {
  if (state === "recorded") return t("crateImport.rowState.recorded");
  if (state === "no_return") return t("crateImport.rowState.noReturn");
  if (state === "awaiting_qty") return t("crateImport.rowState.awaitingQty");
  return t("crateImport.rowState.pending");
}

function rowStateClassName(state: CrateImportRowState) {
  if (state === "recorded") {
    return "bg-green-50/60 ring-1 ring-green-200/70";
  }
  if (state === "no_return") {
    return "bg-slate-50 ring-1 ring-slate-200";
  }
  if (state === "awaiting_qty") {
    return "bg-sky-50/80 ring-1 ring-sky-200/80";
  }
  return "bg-amber-50/80 ring-1 ring-amber-200/80";
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
    noReturn: false,
    awaitingQty: false,
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
    noReturn: row.noReturn ?? false,
    awaitingQty: row.awaitingQty ?? false,
    persistedKey: shouldPersistCrateImportRow({
      truckPlate: row.truckPlate,
      marketCode: row.marketCode,
      quantities: row.quantities,
      notes: row.notes,
      status: row.status,
      noReturn: row.noReturn,
      awaitingQty: row.awaitingQty,
    })
      ? crateImportRowKey(row.truckPlate, row.marketCode)
      : undefined,
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

function formatCompactQuantities(
  quantities: Record<string, string>,
  dynamicColumns: string[]
): string {
  const parts: string[] = [];
  for (const col of TONG_IMPORT_DEFAULT_COLUMNS) {
    const qty = parseQty(quantities[col.key]);
    if (qty > 0) parts.push(`${col.label} ${qty}`);
  }
  for (const name of dynamicColumns) {
    const qty = parseQty(quantities[name]);
    if (qty > 0) parts.push(`${name} ${qty}`);
  }
  return parts.join(" · ");
}

const MOBILE_INPUT_CLASS =
  "min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-right font-mono text-base";
const MOBILE_SELECT_CLASS =
  "min-h-[44px] w-full rounded-lg border border-haidee-border px-2 font-mono text-sm";

interface ImportRowEditorProps {
  row: ImportRow;
  trucks: TruckOption[];
  markets: MarketOption[];
  dynamicColumns: string[];
  onUpdate: (patch: Partial<ImportRow>) => void;
  onUpdateQty: (key: string, value: string) => void;
  onRemove: () => void;
  onRemoveDynamicColumn: (name: string) => void;
  onAddMarketForPlate?: () => void;
  variant: "table-row" | "card";
  inputClass: string;
  selectClass: string;
}

function ImportRowEditor({
  row,
  trucks,
  markets,
  dynamicColumns,
  onUpdate,
  onUpdateQty,
  onRemove,
  onRemoveDynamicColumn,
  onAddMarketForPlate,
  variant,
  inputClass,
  selectClass,
}: ImportRowEditorProps) {
  const { t } = useT();
  const total = row.noReturn ? 0 : rowTotal(row.quantities, dynamicColumns);
  const rowState = deriveCrateImportRowState(row, dynamicColumns);
  const stateLabel = rowStateLabel(rowState, t);
  const qtyDisabled = row.noReturn;

  const noReturnToggle = (
    <label className="inline-flex min-h-[44px] items-center gap-2 text-xs text-haidee-text">
      <input
        type="checkbox"
        checked={row.noReturn}
        disabled={rowState === "awaiting_qty"}
        onChange={(e) =>
          onUpdate({
            noReturn: e.target.checked,
            awaitingQty: false,
            quantities: e.target.checked ? emptyQuantities() : row.quantities,
            notes: e.target.checked ? "" : row.notes,
            status: e.target.checked ? "arrived" : row.status,
          })
        }
        className="h-4 w-4 rounded border-haidee-border"
      />
      <span>{t("crateImport.noReturn")}</span>
    </label>
  );

  const addMarketButton =
    row.truckPlate && onAddMarketForPlate ? (
      <button
        type="button"
        onClick={onAddMarketForPlate}
        className="mt-1 inline-flex items-center gap-1 rounded border border-dashed border-haidee-border px-2 py-1 text-[11px] font-medium text-haidee-blue hover:bg-haidee-surface"
      >
        <Plus className="h-3 w-3" />
        {t("crateImport.addMarketForPlate")}
      </button>
    ) : null;

  const stateBadge = (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
        rowState === "recorded" && "bg-green-100 text-green-800",
        rowState === "no_return" && "bg-slate-200 text-slate-700",
        rowState === "awaiting_qty" && "bg-sky-100 text-sky-800",
        rowState === "pending" && "bg-amber-100 text-amber-800"
      )}
    >
      {stateLabel}
    </span>
  );

  const plateSelect = (
    <select
      value={row.truckPlate}
      onChange={(e) => onUpdate({ truckPlate: e.target.value })}
      className={
        variant === "card"
          ? `${MOBILE_SELECT_CLASS} min-w-0 flex-1`
          : `${selectClass} min-w-[100px]`
      }
      aria-label={t("dispatch.plateField")}
    >
      <option value="">—</option>
      {trucks.map((truck) => (
        <option key={truck.id} value={truck.plate}>
          {truck.plate}
        </option>
      ))}
    </select>
  );

  const marketSelect = (
    <select
      value={row.marketCode}
      onChange={(e) => onUpdate({ marketCode: e.target.value })}
      className={
        variant === "card"
          ? `${MOBILE_SELECT_CLASS} min-w-0 flex-1`
          : `${selectClass} min-w-[72px]`
      }
      aria-label={t("crateImport.sourceMarket")}
    >
      <option value="">—</option>
      {markets.map((m) => (
        <option key={m.id} value={m.code}>
          {m.code} — {m.displayName ?? m.name}
        </option>
      ))}
    </select>
  );

  const statusSelect = (
    <select
      value={row.status}
      onChange={(e) =>
        onUpdate({ status: e.target.value as ImportRow["status"] })
      }
      className={
        variant === "card"
          ? `${MOBILE_SELECT_CLASS} min-w-[7.5rem] shrink-0`
          : `${selectClass} min-w-[90px]`
      }
      aria-label={t("common.status")}
    >
      <option value="on_the_way">
        🟡 {t("crateImport.status.onTheWay")}
      </option>
      <option value="arrived">
        🟢 {t("crateImport.status.arrived")}
      </option>
    </select>
  );

  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      className={cn(
        "rounded-lg text-haidee-muted hover:text-haidee-red",
        variant === "card"
          ? "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center"
          : "p-1"
      )}
      aria-label={t("common.delete")}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );

  if (variant === "card") {
    return (
      <article
        className={cn(
          "rounded-xl border border-haidee-border p-4",
          rowStateClassName(rowState),
          row.status === "on_the_way" && rowState === "recorded" && "bg-yellow-50/80"
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {stateBadge}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {plateSelect}
          {marketSelect}
          {statusSelect}
          {removeButton}
        </div>
        {addMarketButton}

        <div className="mt-3 space-y-2">
          {TONG_IMPORT_DEFAULT_COLUMNS.map((col) => (
            <div key={col.key} className="flex items-center gap-3">
              <label
                htmlFor={`${row.id}-qty-${col.key}`}
                className="w-14 shrink-0 font-mono text-sm font-semibold text-haidee-text"
              >
                {col.label}
              </label>
              <input
                id={`${row.id}-qty-${col.key}`}
                type="text"
                inputMode="numeric"
                value={row.quantities[col.key] ?? ""}
                onChange={(e) => {
                  onUpdate({ noReturn: false, awaitingQty: false });
                  onUpdateQty(col.key, e.target.value);
                }}
                disabled={qtyDisabled}
                className={cn(MOBILE_INPUT_CLASS, qtyDisabled && "opacity-50")}
              />
            </div>
          ))}
          {dynamicColumns.map((name) => (
            <div key={name} className="flex items-center gap-3">
              <span className="inline-flex w-14 shrink-0 items-center gap-0.5 font-mono text-sm font-semibold text-haidee-text">
                {name}
                <button
                  type="button"
                  onClick={() => onRemoveDynamicColumn(name)}
                  className="rounded p-0.5 text-haidee-muted hover:text-haidee-red"
                  aria-label={t("crateImport.removeColumnAria", { name })}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={row.quantities[name] ?? ""}
                onChange={(e) => {
                  onUpdate({ noReturn: false, awaitingQty: false });
                  onUpdateQty(name, e.target.value);
                }}
                disabled={qtyDisabled}
                className={cn(MOBILE_INPUT_CLASS, qtyDisabled && "opacity-50")}
              />
            </div>
          ))}
        </div>

        <div className="mt-3">{noReturnToggle}</div>

        <div className="mt-3 space-y-1">
          <label
            htmlFor={`${row.id}-notes`}
            className="text-sm font-medium text-haidee-text"
          >
            {t("common.notes")}
          </label>
          <input
            id={`${row.id}-notes`}
            type="text"
            value={row.notes}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            className={`${MOBILE_INPUT_CLASS} text-left`}
          />
        </div>

        <div className="mt-3 text-right font-mono text-base font-semibold text-haidee-text">
          {t("common.total")}: {total || 0}
        </div>
      </article>
    );
  }

  return (
    <tr
      className={cn(
        "border-b border-haidee-border/60",
        rowStateClassName(rowState),
        row.status === "on_the_way" &&
          rowState === "recorded" &&
          "bg-yellow-50/80"
      )}
    >
      <td className={cn(STICKY_BODY_FIRST, "px-1 py-1")}>
        <div className="space-y-1">
          {plateSelect}
          {stateBadge}
          {addMarketButton}
        </div>
      </td>
      <td className="px-1 py-1">{marketSelect}</td>
      {TONG_IMPORT_DEFAULT_COLUMNS.map((col) => (
        <td key={col.key} className="px-1 py-1">
          <input
            type="text"
            inputMode="numeric"
            value={row.quantities[col.key] ?? ""}
            onChange={(e) => {
              onUpdate({ noReturn: false, awaitingQty: false });
              onUpdateQty(col.key, e.target.value);
            }}
            disabled={qtyDisabled}
            className={cn(`${inputClass} w-12`, qtyDisabled && "opacity-50")}
          />
        </td>
      ))}
      {dynamicColumns.map((name) => (
        <td key={name} className="px-1 py-1">
          <input
            type="text"
            inputMode="numeric"
            value={row.quantities[name] ?? ""}
            onChange={(e) => {
              onUpdate({ noReturn: false, awaitingQty: false });
              onUpdateQty(name, e.target.value);
            }}
            disabled={qtyDisabled}
            className={cn(`${inputClass} w-12`, qtyDisabled && "opacity-50")}
          />
        </td>
      ))}
      <td className="px-1 py-1">{noReturnToggle}</td>
      <td className="px-1 py-1">{statusSelect}</td>
      <td className="px-1 py-1">
        <input
          type="text"
          value={row.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          className={`${inputClass} w-full min-w-[80px] text-left`}
        />
      </td>
      <td className="px-2 py-1 text-center font-mono font-semibold">
        {total || ""}
      </td>
      <td className="px-1 py-1">{removeButton}</td>
    </tr>
  );
}

interface ImportTodaySummaryBarProps {
  columnTotals: Record<string, number>;
  grandTotal: number;
  dynamicColumns: string[];
  onAddColumn: () => void;
  addColumnDisabled: boolean;
}

function ImportTodaySummaryBar({
  columnTotals,
  grandTotal,
  dynamicColumns,
  onAddColumn,
  addColumnDisabled,
}: ImportTodaySummaryBarProps) {
  const { t } = useT();

  const parts: string[] = [];
  for (const col of TONG_IMPORT_DEFAULT_COLUMNS) {
    const qty = columnTotals[col.key] ?? 0;
    if (qty > 0) parts.push(`${col.label} ${qty}`);
  }
  for (const name of dynamicColumns) {
    const qty = columnTotals[name] ?? 0;
    if (qty > 0) parts.push(`${name} ${qty}`);
  }

  return (
    <div className="space-y-3 rounded-xl border border-haidee-border bg-haidee-surface p-4">
      <div className="font-semibold text-haidee-text">{t("common.total")}</div>
      {parts.length > 0 ? (
        <p className="font-mono text-sm leading-relaxed text-haidee-text">
          {parts.join(" · ")}
        </p>
      ) : (
        <p className="text-sm text-haidee-muted">—</p>
      )}
      <p className="font-mono text-base font-bold text-haidee-text">
        {t("common.total")}: {grandTotal || 0}
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={onAddColumn}
        disabled={addColumnDisabled}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        {t("crateImport.addColumn")}
      </Button>
    </div>
  );
}

interface InTransitMobileCardProps {
  row: InTransitImportRow;
  allDynamicColumns: string[];
  isPending: boolean;
  onStatusChange: (
    row: InTransitImportRow,
    status: "on_the_way" | "arrived"
  ) => void;
}

function InTransitMobileCard({
  row,
  allDynamicColumns,
  isPending,
  onStatusChange,
}: InTransitMobileCardProps) {
  const { t } = useT();
  const compactQty = formatCompactQuantities(row.quantities, allDynamicColumns);
  const total = rowTotal(row.quantities, allDynamicColumns);

  return (
    <article className="rounded-xl border border-haidee-border bg-yellow-50/80 p-4">
      <div className="font-mono text-base font-semibold text-haidee-text">
        {row.truckPlate}
      </div>
      <div className="mt-1 text-sm text-haidee-muted">
        {row.dateStr} · {row.marketCode}
      </div>
      {compactQty ? (
        <p className="mt-2 font-mono text-sm leading-relaxed text-haidee-text">
          {compactQty}
        </p>
      ) : null}
      {row.notes ? (
        <p className="mt-2 text-sm text-haidee-muted">
          {t("common.notes")}: {row.notes}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <select
          value={row.status}
          onChange={(e) =>
            onStatusChange(row, e.target.value as "on_the_way" | "arrived")
          }
          disabled={isPending}
          className={`${MOBILE_SELECT_CLASS} min-w-[10rem] flex-1`}
          aria-label={t("common.status")}
        >
          <option value="on_the_way">
            🟡 {t("crateImport.status.onTheWay")}
          </option>
          <option value="arrived">
            🟢 {t("crateImport.status.arrived")}
          </option>
        </select>
        <span className="font-mono text-sm font-semibold text-haidee-text">
          {t("common.total")}: {total || 0}
        </span>
      </div>
    </article>
  );
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
  const { t } = useT();
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

  const [deletedRowKeys, setDeletedRowKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [lastSaveCounts, setLastSaveCounts] = useState({
    savedCount: 0,
    skippedCount: 0,
  });
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [selectedColumnCode, setSelectedColumnCode] = useState("");

  const isFirstDateEffect = useRef(true);

  function applyLoadedImportData(
    data: Awaited<ReturnType<typeof loadCrateImportsForDate>>
  ) {
    setDispatchedPlates(data.dispatchedPlates);
    setDynamicColumns(data.dynamicColumns);
    setRows(
      data.rows.length > 0 ? data.rows.map(rowFromLoaded) : [emptyRow()]
    );
    setDeletedRowKeys([]);
    setSaveMessage(null);
    setLastSaveCounts({ savedCount: 0, skippedCount: 0 });
  }

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

        applyLoadedImportData(data);
        setError(null);
        setSuccess(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("error.loadFailed"));
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, t]);

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
        hint: t("crateImport.otherColumnHint"),
      });
    }

    return options;
  }, [crateTypes, usedColumnCodes, t]);

  async function refreshInTransit() {
    const data = await loadInTransitCrateImports();
    setInTransitRows(data.rows);
    setInTransitDynamicColumns(data.dynamicColumns);
  }

  function updateRow(id: string, patch: Partial<ImportRow>) {
    setRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (
        row?.persistedKey &&
        patch.marketCode !== undefined &&
        patch.marketCode !== parseCrateImportRowKey(row.persistedKey).marketCode
      ) {
        setDeletedRowKeys((keys) =>
          keys.includes(row.persistedKey!) ? keys : [...keys, row.persistedKey!]
        );
      }

      return prev.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (
          patch.marketCode !== undefined &&
          r.persistedKey &&
          patch.marketCode !== parseCrateImportRowKey(r.persistedKey).marketCode
        ) {
          next.persistedKey = undefined;
        }
        return next;
      });
    });
  }

  function addMarketRowForPlate(plate: string) {
    if (!plate.trim()) return;
    const newRow: ImportRow = {
      ...emptyRow(),
      truckPlate: plate,
    };
    setRows((prev) => {
      let insertAt = prev.length;
      for (let i = prev.length - 1; i >= 0; i -= 1) {
        if (prev[i]?.truckPlate === plate) {
          insertAt = i + 1;
          break;
        }
      }
      return [...prev.slice(0, insertAt), newRow, ...prev.slice(insertAt)];
    });
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
      setError(t("crateImport.error.noMoreTypes"));
      return;
    }
    setSelectedColumnCode(addableColumnOptions[0]?.code ?? "");
    setAddColumnOpen(true);
    setError(null);
  }

  function confirmAddColumn() {
    if (!selectedColumnCode) return;
    if (usedColumnCodes.has(selectedColumnCode)) {
      setError(
        t("crateImport.error.columnExists", { code: selectedColumnCode })
      );
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

  function removeRow(row: ImportRow) {
    if (row.persistedKey) {
      setDeletedRowKeys((prev) =>
        prev.includes(row.persistedKey!) ? prev : [...prev, row.persistedKey!]
      );
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  function handleSaveToday() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        const result = await saveTongImport(
          selectedDate,
          rows.map((r) => ({
            truckPlate: r.truckPlate,
            marketCode: r.marketCode,
            quantities: r.quantities,
            notes: r.notes || undefined,
            status: r.status,
            noReturn: r.noReturn,
          })),
          deletedRowKeys
        );
        const data = await loadCrateImportsForDate(selectedDate);
        applyLoadedImportData(data);
        await refreshInTransit();
        setSuccess(true);
        setLastSaveCounts({
          savedCount: result.savedCount,
          skippedCount: result.skippedCount,
        });
        setSaveMessage(
          t("crateImport.saveResult", {
            saved: String(result.savedCount),
            skipped: String(result.skippedCount),
          })
        );
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("error.saveFailed"));
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
        setError(
          e instanceof Error ? e.message : t("crateImport.error.updateFailed")
        );
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
      <section className="space-y-4 pb-24 md:pb-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h3 className="text-lg font-semibold text-haidee-text">
            {t("crateImport.todaySection")}
          </h3>
          <DateInputField
            value={selectedDate}
            onChange={setSelectedDate}
            className="w-[11.5rem] shrink-0"
          />
        </div>

        {/* Mobile: per-truck cards */}
        <div className="space-y-4 md:hidden">
          <ImportTodaySummaryBar
            columnTotals={columnTotals}
            grandTotal={grandTotal}
            dynamicColumns={dynamicColumns}
            onAddColumn={openAddColumnDialog}
            addColumnDisabled={addableColumnOptions.length === 0}
          />
          <div className="space-y-3">
            {rows.map((row) => (
              <ImportRowEditor
                key={row.id}
                row={row}
                trucks={trucks}
                markets={markets}
                dynamicColumns={dynamicColumns}
                onUpdate={(patch) => updateRow(row.id, patch)}
                onUpdateQty={(key, value) => updateQty(row.id, key, value)}
                onRemove={() => removeRow(row)}
                onRemoveDynamicColumn={removeDynamicColumn}
                onAddMarketForPlate={() => addMarketRowForPlate(row.truckPlate)}
                variant="card"
                inputClass={inputClass}
                selectClass={selectClass}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("crateImport.addRow")}
          </Button>
        </div>

        {/* Desktop: matrix table (unchanged) */}
        <div className="hidden space-y-4 md:block">
          <ScrollMatrixTable heightOffset={320}>
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
                  <th className={cn(STICKY_HEAD_FIRST, "px-2 py-2 text-left")}>
                    {t("dispatch.plateField")}
                  </th>
                  <th className="px-2 py-2 text-left">
                    {t("crateImport.sourceMarket")}
                  </th>
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
                          aria-label={t("crateImport.removeColumnAria", {
                            name,
                          })}
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
                      {t("crateImport.addColumn")}
                    </button>
                  </th>
                  <th className="px-2 py-2">{t("crateImport.noReturn")}</th>
                  <th className="px-2 py-2">{t("common.status")}</th>
                  <th className="px-2 py-2">{t("common.notes")}</th>
                  <th className="px-2 py-2">{t("common.total")}</th>
                  <th className="px-1 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ImportRowEditor
                    key={row.id}
                    row={row}
                    trucks={trucks}
                    markets={markets}
                    dynamicColumns={dynamicColumns}
                    onUpdate={(patch) => updateRow(row.id, patch)}
                    onUpdateQty={(key, value) => updateQty(row.id, key, value)}
                    onRemove={() => removeRow(row)}
                    onRemoveDynamicColumn={removeDynamicColumn}
                    onAddMarketForPlate={() => addMarketRowForPlate(row.truckPlate)}
                    variant="table-row"
                    inputClass={inputClass}
                    selectClass={selectClass}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-haidee-border bg-haidee-surface font-semibold text-haidee-text">
                  <td className="px-2 py-2" colSpan={2}>
                    {t("common.total")}
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
            {t("crateImport.addRow")}
          </Button>

          <div className="space-y-3">
            <SaveFeedback
              error={error}
              success={success}
              saveMessage={saveMessage}
              savedCount={lastSaveCounts.savedCount}
              skippedCount={lastSaveCounts.skippedCount}
              t={t}
            />
            <Button
              onClick={handleSaveToday}
              disabled={isPending}
              className="min-h-[44px] bg-haidee-blue text-white hover:bg-haidee-blue/90"
            >
              {isPending ? t("common.saving") : t("crateImport.confirmSave")}
            </Button>
          </div>
        </div>
      </section>

      {/* Mobile sticky save */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-haidee-border bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:hidden">
        <div className="space-y-3">
          <SaveFeedback
            error={error}
            success={success}
            saveMessage={saveMessage}
            savedCount={lastSaveCounts.savedCount}
            skippedCount={lastSaveCounts.skippedCount}
            t={t}
          />
          <Button
            onClick={handleSaveToday}
            disabled={isPending}
            className="min-h-[48px] w-full bg-haidee-blue text-base text-white hover:bg-haidee-blue/90"
          >
            {isPending ? t("common.saving") : t("crateImport.confirmSave")}
          </Button>
        </div>
      </div>

      {/* In transit section */}
      {inTransitRows.length > 0 && (
        <section className="space-y-4 pb-24 md:pb-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold text-haidee-text">
              {t("crateImport.inTransitTitle")}
            </h3>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-medium text-haidee-orange">
              {t("crateImport.inTransitCount", {
                n: String(inTransitTruckCount),
              })}
            </span>
          </div>

          <div className="space-y-3 md:hidden">
            {inTransitRows.map((row) => (
              <InTransitMobileCard
                key={`${row.dateInput}-${row.truckPlate}-${row.marketCode}`}
                row={row}
                allDynamicColumns={allDynamicColumns}
                isPending={isPending}
                onStatusChange={handleInTransitStatusChange}
              />
            ))}
          </div>

          <div className="hidden md:block">
            <ScrollMatrixTable heightOffset={320}>
              <table className="w-full min-w-[960px] text-xs">
                <thead>
                  <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
                    <th
                      className={cn(STICKY_HEAD_FIRST, "px-2 py-2 text-left")}
                    >
                      {t("dispatch.plateField")}
                    </th>
                    <th className={cn(STICKY_HEAD_TOP, "px-2 py-2 text-left")}>
                      {t("common.date")}
                    </th>
                    <th className="px-2 py-2 text-left">
                      {t("crateImport.sourceMarket")}
                    </th>
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
                    <th className="px-2 py-2">{t("common.status")}</th>
                    <th className="px-2 py-2">{t("common.notes")}</th>
                    <th className="px-2 py-2">{t("common.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {inTransitRows.map((row) => (
                    <tr
                      key={`${row.dateInput}-${row.truckPlate}-${row.marketCode}`}
                      className="border-b border-haidee-border/60 bg-yellow-50/80"
                    >
                      <td
                        className={cn(
                          STICKY_BODY_FIRST,
                          "px-2 py-1 font-mono"
                        )}
                      >
                        {row.truckPlate}
                      </td>
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
                          <option value="on_the_way">
                            🟡 {t("crateImport.status.onTheWay")}
                          </option>
                          <option value="arrived">
                            🟢 {t("crateImport.status.arrived")}
                          </option>
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
          </div>
        </section>
      )}

      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("crateImport.addColumnTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-haidee-text">
              {t("crateImport.selectCrateType")}
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
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={confirmAddColumn}
              disabled={!selectedColumnCode}
              className="bg-haidee-blue text-white hover:bg-haidee-blue/90"
            >
              {t("inbound.confirmAdd")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

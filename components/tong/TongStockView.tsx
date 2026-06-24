"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { setSadaoTongStockAbsolute } from "@/app/actions/tong";
import { DateInputField } from "@/components/shared/DateInputField";
import { useCanWrite } from "@/components/shared/can-write-context";
import { useT } from "@/components/shared/locale-context";
import { MobileTruncatedName } from "@/components/shared/MobileTruncatedName";
import { formatDisplayDate } from "@/lib/date-utils";
import { toDateInputValue } from "@/lib/inbound-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StockRow {
  tongTypeId: string;
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
  type: "IN" | "OUT" | "ADJ";
  plate: string;
  party: string;
  tongCode: string;
  quantity: number;
  signedQty: string;
  balance: number;
  notes: string | null;
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
  const canWrite = useCanWrite();
  const { t, parts } = useT();
  const [isPending, startTransition] = useTransition();
  const [editRow, setEditRow] = useState<StockRow | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editDate, setEditDate] = useState(toDateInputValue(new Date()));
  const [editNotes, setEditNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function ledgerTypeLabel(type: LedgerRow["type"]) {
    if (type === "IN") return t("crateStock.ledger.in");
    if (type === "OUT") return t("crateStock.ledger.out");
    return t("crateStock.ledger.adj");
  }

  function openEdit(row: StockRow) {
    setError(null);
    setEditRow(row);
    setEditQty(String(row.stock));
    setEditDate(toDateInputValue(new Date()));
    setEditNotes(t("crateStock.adjustmentDefaultNotes"));
  }

  function handleSaveEdit() {
    if (!editRow) return;
    setError(null);
    const targetQuantity = parseInt(editQty, 10);
    if (Number.isNaN(targetQuantity)) {
      setError(t("crateStock.error.invalidQty"));
      return;
    }

    startTransition(async () => {
      try {
        await setSadaoTongStockAbsolute({
          tongTypeId: editRow.tongTypeId,
          targetQuantity,
          date: editDate,
          notes: editNotes || undefined,
        });
        setEditRow(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("error.saveFailed"));
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
        <div className="border-b border-haidee-border px-4 py-3">
          <h3 className="font-semibold text-haidee-text">
            {t("crateStock.sadaoStockTitle")}
          </h3>
          <p className="text-sm text-haidee-muted">{displayDate}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>{t("common.crateType")}</TableHead>
              <TableHead className="text-right">{t("crateStock.stock")}</TableHead>
              <TableHead className="text-right">{t("crateStock.todayIn")}</TableHead>
              <TableHead className="text-right">{t("crateStock.todayOut")}</TableHead>
              <TableHead className="text-right">{t("crateExport.shortage")}</TableHead>
              {canWrite ? (
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              ) : null}
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
                      {row.shortage}
                      {parts("common.crateUnit").local}
                    </span>
                  ) : (
                    "0"
                  )}
                </TableCell>
                {canWrite ? (
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center text-haidee-blue hover:text-haidee-blue/80"
                      aria-label={t("common.edit")}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {shortages.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
          <div className="border-b border-haidee-border px-4 py-3">
            <h3 className="font-semibold text-haidee-text">
              {t("crateStock.shortageTitle")}
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>{t("common.consignor")}</TableHead>
                <TableHead>{t("common.crateType")}</TableHead>
                <TableHead className="text-right">{t("crateStock.shortageQty")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("crateStock.receiptNo")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shortages.map((s, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <MobileTruncatedName text={s.shipperName} />
                  </TableCell>
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

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-4">
          <h3 className="font-semibold text-haidee-text">
            {t("crateStock.ledgerTitle")}
          </h3>
          <div className="space-y-1">
            <label className="text-xs text-haidee-muted">
              {t("common.date")}
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
            <p className="p-8 text-center text-haidee-muted">
              {t("crateStock.emptyLedger")}
            </p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("crateStock.type")}</TableHead>
                  <TableHead>{t("dispatch.plateField")}</TableHead>
                  <TableHead>{t("crateStock.party")}</TableHead>
                  <TableHead>{t("common.crateType")}</TableHead>
                  <TableHead className="text-right">{t("common.qty")}</TableHead>
                  <TableHead className="text-right">{t("crateStock.balance")}</TableHead>
                  <TableHead className="min-w-[88px]">{t("common.notes")}</TableHead>
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
                            : e.type === "OUT"
                              ? "font-semibold text-haidee-red"
                              : "font-semibold text-haidee-blue"
                        }
                      >
                        {ledgerTypeLabel(e.type)}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono">{e.plate}</TableCell>
                    <TableCell>
                      <MobileTruncatedName text={e.party} />
                    </TableCell>
                    <TableCell className="font-mono">{e.tongCode}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {e.signedQty}
                    </TableCell>
                    <TableCell className="text-right font-mono text-haidee-muted">
                      {e.balance}
                    </TableCell>
                    <TableCell className="max-w-[160px] text-sm text-haidee-muted">
                      {e.notes ? (
                        <MobileTruncatedName text={e.notes} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={editRow !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setEditRow(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editRow
                ? t("crateStock.editTitle", { code: editRow.code })
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-haidee-muted">
                {t("common.date")}
              </label>
              <DateInputField value={editDate} onChange={setEditDate} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-haidee-muted">
                {t("crateStock.targetQty")}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={editQty}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "" || /^\d*$/.test(next)) {
                    setEditQty(next);
                  }
                }}
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-haidee-muted">
                {t("common.notes")}
              </label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder={parts("common.optional").local}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditRow(null)}
              disabled={isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

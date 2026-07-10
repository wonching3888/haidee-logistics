"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  deletePattaniHandling,
  getStationDispatchTotalsForDate,
  savePattaniHandling,
  type PattaniHandlingRow,
  type ThaiDriverRow,
} from "@/app/actions/thai-cost-phase2";
import { useT } from "@/components/shared/locale-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HandlingHistoryLink } from "@/components/thai-cost/handling/HandlingHistoryLink";
import { StationTripsDisplay } from "@/components/thai-cost/handling/StationTripsDisplay";

export function PattaniHandlingDayPanel({
  date,
  existingRow,
  drivers,
  canWrite,
  rates,
}: {
  date: string;
  existingRow: PattaniHandlingRow | null;
  drivers: ThaiDriverRow[];
  canWrite: boolean;
  rates?: {
    pattaniContractorCrate: number;
    pattaniContractorBox: number;
    pattaniSakriCrate: number;
  };
}) {
  const router = useRouter();
  const { tLocal } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState(false);
  const [dispatchTotals, setDispatchTotals] = useState({ crateQty: 0, boxQty: 0 });
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [qtyForm, setQtyForm] = useState({ crate: "0", box: "0" });
  const [notes, setNotes] = useState(existingRow?.notes ?? "");

  const previewRates = rates ?? {
    pattaniContractorCrate: 20,
    pattaniContractorBox: 5,
    pattaniSakriCrate: 2.2,
  };

  const display = existingRow?.manualQty
    ? { crate: existingRow.crateQty, box: existingRow.boxQty }
    : { crate: dispatchTotals.crateQty, box: dispatchTotals.boxQty };

  const previewCosts = {
    contractorThb:
      Math.round(
        (display.crate * previewRates.pattaniContractorCrate +
          display.box * previewRates.pattaniContractorBox) *
          100
      ) / 100,
    sakriCommissionThb:
      Math.round(display.crate * previewRates.pattaniSakriCrate * 100) / 100,
  };

  useEffect(() => {
    setNotes(existingRow?.notes ?? "");
    setEditingQty(false);
    setError(null);
  }, [date, existingRow]);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoadingDispatch(true);
    getStationDispatchTotalsForDate(date, "PATTANI")
      .then((totals) => {
        if (!cancelled) {
          setDispatchTotals({
            crateQty: totals.crateQty,
            boxQty: totals.boxTotalQty,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setDispatchTotals({ crateQty: 0, boxQty: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoadingDispatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  function startEditQty() {
    setQtyForm({ crate: String(display.crate), box: String(display.box) });
    setEditingQty(true);
  }

  function saveManualQty() {
    setError(null);
    startTransition(async () => {
      try {
        await savePattaniHandling({
          id: existingRow?.id,
          date,
          manualQty: true,
          crateQty: Number(qtyForm.crate),
          boxQty: Number(qtyForm.box),
          notes: notes || null,
        });
        setEditingQty(false);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : tLocal("thaiCost.common.failed")
        );
      }
    });
  }

  function restoreAuto() {
    setError(null);
    startTransition(async () => {
      try {
        await savePattaniHandling({
          id: existingRow?.id,
          date,
          manualQty: false,
          notes: notes || null,
        });
        setEditingQty(false);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : tLocal("thaiCost.common.failed")
        );
      }
    });
  }

  function saveNotesOnly() {
    setError(null);
    startTransition(async () => {
      try {
        await savePattaniHandling({
          id: existingRow?.id,
          date,
          manualQty: existingRow?.manualQty ?? false,
          crateQty: display.crate,
          boxQty: display.box,
          notes: notes || null,
        });
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : tLocal("thaiCost.common.failed")
        );
      }
    });
  }

  const year = date.slice(0, 4);
  const month = date.slice(5, 7);

  return (
    <section className="space-y-3 rounded-lg border border-haidee-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">
          {tLocal("thaiCost.pattaniHandling.pageTitle")}
        </h3>
        <Link
          href={`/thai-cost/pattani-contractor-monthly?year=${year}&month=${month}`}
          className="text-sm text-haidee-blue underline"
        >
          {tLocal("thaiCost.pattaniContractorMonthly.link")}
        </Link>
      </div>
      <p className="text-sm text-haidee-muted">
        {tLocal("thaiCost.pattaniHandling.intro")}
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <div className="rounded-md border border-haidee-border bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {tLocal("thaiCost.pattaniHandling.dispatchTotalsEditable")}
          </p>
          {canWrite && !editingQty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loadingDispatch || isPending}
              onClick={startEditQty}
              aria-label={tLocal("thaiCost.handling.editDispatchTotals")}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        {loadingDispatch && !existingRow?.manualQty ? (
          <p className="text-haidee-muted">{tLocal("thaiCost.common.loading")}</p>
        ) : editingQty ? (
          <div className="mt-2 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>{tLocal("thaiCost.pattaniHandling.colCrates")}</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={qtyForm.crate}
                  onChange={(e) =>
                    setQtyForm((f) => ({ ...f, crate: e.target.value }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{tLocal("thaiCost.pattaniHandling.colBoxes")}</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={qtyForm.box}
                  onChange={(e) =>
                    setQtyForm((f) => ({ ...f, box: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-haidee-blue text-white"
                disabled={isPending}
                onClick={saveManualQty}
              >
                {tLocal("thaiCost.common.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={restoreAuto}
              >
                {tLocal("thaiCost.handling.restoreAutoTotals")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isPending}
                onClick={() => setEditingQty(false)}
              >
                {tLocal("thaiCost.common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 font-mono text-sm">
              {tLocal("thaiCost.pattaniHandling.colCrates")} {display.crate} /{" "}
              {tLocal("thaiCost.pattaniHandling.colBoxes")} {display.box}
            </p>
            <p className="mt-2 text-xs text-haidee-muted">
              {tLocal("thaiCost.pattaniHandling.billablePreview", {
                crate: String(display.crate),
                box: String(display.box),
              })}
            </p>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-sm font-medium">
            {tLocal("thaiCost.pattaniHandling.colContractor")}
          </p>
          <p className="text-xs text-haidee-muted">
            {tLocal("thaiCost.handling.pattaniContractorNote")}
          </p>
          <p className="mt-2 font-mono text-lg font-semibold">
            {existingRow
              ? existingRow.contractorThb.toFixed(2)
              : previewCosts.contractorThb.toFixed(2)}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-sm font-medium">
            {tLocal("thaiCost.pattaniHandling.colSakri")}
          </p>
          <p className="text-xs text-haidee-muted">
            {tLocal("thaiCost.handling.pattaniSakriNote")}
          </p>
          <p className="mt-2 font-mono text-lg font-semibold">
            {existingRow
              ? existingRow.sakriCommissionThb.toFixed(2)
              : previewCosts.sakriCommissionThb.toFixed(2)}
          </p>
        </div>
      </div>

      <StationTripsDisplay
        date={date}
        station="PATTANI"
        drivers={drivers}
        canWrite={canWrite}
      />

      {canWrite && (
        <div className="space-y-3 rounded-lg border bg-haidee-surface/50 p-4">
          <label className="block space-y-1 text-sm">
            <span>{tLocal("thaiCost.common.notes")}</span>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tLocal("thaiCost.sadaoHandling.notesPlaceholder")}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isPending || loadingDispatch}
              className="bg-haidee-blue text-white"
              onClick={saveNotesOnly}
            >
              {existingRow
                ? tLocal("thaiCost.common.save")
                : tLocal("thaiCost.songkhlaHandling.addRecord")}
            </Button>
            {existingRow && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  if (!confirm(tLocal("thaiCost.common.deleteConfirm"))) return;
                  startTransition(async () => {
                    await deletePattaniHandling(existingRow.id);
                    router.refresh();
                  });
                }}
              >
                {tLocal("thaiCost.common.delete")}
              </Button>
            )}
          </div>
        </div>
      )}

      <HandlingHistoryLink station="pattani" date={date} />
    </section>
  );
}

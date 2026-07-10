"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  deleteSongkhlaHandling,
  getStationDispatchTotalsForDate,
  saveSongkhlaHandling,
  type SongkhlaHandlingRow,
  type ThaiDriverRow,
} from "@/app/actions/thai-cost-phase2";
import { useT } from "@/components/shared/locale-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HandlingHistoryLink } from "@/components/thai-cost/handling/HandlingHistoryLink";
import { StationTripsDisplay } from "@/components/thai-cost/handling/StationTripsDisplay";

export function SongkhlaHandlingDayPanel({
  date,
  existingRow,
  drivers,
  canWrite,
}: {
  date: string;
  existingRow: SongkhlaHandlingRow | null;
  drivers: ThaiDriverRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { tLocal } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState(false);
  const [dispatchTotals, setDispatchTotals] = useState({
    smallCrateTotalQty: 0,
    largeCrateTotalQty: 0,
    boxTotalQty: 0,
  });
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [qtyForm, setQtyForm] = useState({
    small: "0",
    large: "0",
    box: "0",
  });
  const [notes, setNotes] = useState(existingRow?.notes ?? "");

  // Effective display: locked row uses its totals; else live dispatch
  const display = existingRow?.manualQty
    ? {
        small: existingRow.smallCrateTotalQty,
        large: existingRow.largeCrateTotalQty,
        box: existingRow.boxTotalQty,
      }
    : {
        small: dispatchTotals.smallCrateTotalQty,
        large: dispatchTotals.largeCrateTotalQty,
        box: dispatchTotals.boxTotalQty,
      };

  const billablePreview = {
    crate: display.small + display.large,
    box: display.box,
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
    getStationDispatchTotalsForDate(date, "SONGKHLA")
      .then((totals) => {
        if (!cancelled) {
          setDispatchTotals({
            smallCrateTotalQty: totals.smallCrateTotalQty,
            largeCrateTotalQty: totals.largeCrateTotalQty,
            boxTotalQty: totals.boxTotalQty,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDispatchTotals({
            smallCrateTotalQty: 0,
            largeCrateTotalQty: 0,
            boxTotalQty: 0,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDispatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  function startEditQty() {
    setQtyForm({
      small: String(display.small),
      large: String(display.large),
      box: String(display.box),
    });
    setEditingQty(true);
  }

  function saveManualQty() {
    setError(null);
    startTransition(async () => {
      try {
        await saveSongkhlaHandling({
          id: existingRow?.id,
          date,
          manualQty: true,
          smallCrateTotalQty: Number(qtyForm.small),
          largeCrateTotalQty: Number(qtyForm.large),
          boxTotalQty: Number(qtyForm.box),
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
        await saveSongkhlaHandling({
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
        await saveSongkhlaHandling({
          id: existingRow?.id,
          date,
          manualQty: existingRow?.manualQty ?? false,
          smallCrateTotalQty: display.small,
          largeCrateTotalQty: display.large,
          boxTotalQty: display.box,
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

  return (
    <section className="space-y-3 rounded-lg border border-haidee-border p-4">
      <h3 className="text-lg font-semibold">
        {tLocal("thaiCost.songkhlaHandling.pageTitle")}
      </h3>
      <p className="text-sm text-haidee-muted">
        {tLocal("thaiCost.songkhlaHandling.intro")}
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <div className="rounded-md border border-haidee-border bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {tLocal("thaiCost.songkhlaHandling.dispatchTotalsEditable")}
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
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span>{tLocal("thaiCost.sadaoHandling.smallCrate")}</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={qtyForm.small}
                  onChange={(e) =>
                    setQtyForm((f) => ({ ...f, small: e.target.value }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{tLocal("thaiCost.sadaoHandling.largeCrate")}</span>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={qtyForm.large}
                  onChange={(e) =>
                    setQtyForm((f) => ({ ...f, large: e.target.value }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{tLocal("thaiCost.sadaoHandling.box")}</span>
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
              {tLocal("thaiCost.dailyOverview.billableBreakdown", {
                small: String(display.small),
                large: String(display.large),
                box: String(display.box),
              })}
            </p>
            <p className="mt-2 text-xs text-haidee-muted">
              {tLocal("thaiCost.songkhlaHandling.billablePreview", {
                crate: String(billablePreview.crate),
                box: String(billablePreview.box),
              })}
            </p>
          </>
        )}
      </div>

      {existingRow && (
        <div className="rounded-md bg-haidee-surface/60 p-3 text-sm">
          <p>
            {tLocal("thaiCost.songkhlaHandling.colCommission")}:{" "}
            <span className="font-mono font-medium">
              {existingRow.commissionThb.toFixed(2)}
            </span>
            <span className="ml-2 text-xs text-haidee-muted">
              ({existingRow.crateCommissionThb.toFixed(2)}+
              {existingRow.boxCommissionThb.toFixed(2)})
            </span>
          </p>
        </div>
      )}

      <StationTripsDisplay
        date={date}
        station="SONGKHLA"
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
              {tLocal("thaiCost.common.save")}
            </Button>
            {existingRow && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  if (!confirm(tLocal("thaiCost.common.deleteConfirm"))) return;
                  startTransition(async () => {
                    await deleteSongkhlaHandling(existingRow.id);
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

      <HandlingHistoryLink station="songkhla" date={date} />
    </section>
  );
}

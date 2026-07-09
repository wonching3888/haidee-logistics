"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [dispatchTotals, setDispatchTotals] = useState({
    smallCrateTotalQty: 0,
    largeCrateTotalQty: 0,
    boxTotalQty: 0,
  });
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [notes, setNotes] = useState(existingRow?.notes ?? "");

  useEffect(() => {
    setNotes(existingRow?.notes ?? "");
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

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveSongkhlaHandling({
          id: existingRow?.id,
          date,
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
        <p className="text-sm font-medium">
          {tLocal("thaiCost.songkhlaHandling.dispatchTotals")}
        </p>
        {loadingDispatch ? (
          <p className="text-haidee-muted">{tLocal("thaiCost.common.loading")}</p>
        ) : (
          <p className="font-mono text-sm">
            {tLocal("thaiCost.dailyOverview.billableBreakdown", {
              small: String(dispatchTotals.smallCrateTotalQty),
              large: String(dispatchTotals.largeCrateTotalQty),
              box: String(dispatchTotals.boxTotalQty),
            })}
          </p>
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
        <form
          className="space-y-3 rounded-lg border bg-haidee-surface/50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span>{tLocal("thaiCost.common.notes")}</span>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={isPending || loadingDispatch}
              className="bg-haidee-blue text-white"
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
        </form>
      )}

      <HandlingHistoryLink station="songkhla" date={date} />
    </section>
  );
}

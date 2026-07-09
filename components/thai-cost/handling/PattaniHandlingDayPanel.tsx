"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
}: {
  date: string;
  existingRow: PattaniHandlingRow | null;
  drivers: ThaiDriverRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { tLocal } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dispatchTotals, setDispatchTotals] = useState({ crateQty: 0, boxQty: 0 });
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

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await savePattaniHandling({
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
        <p className="text-sm font-medium">
          {tLocal("thaiCost.pattaniHandling.dispatchTotals")}
        </p>
        {loadingDispatch ? (
          <p className="text-haidee-muted">{tLocal("thaiCost.common.loading")}</p>
        ) : (
          <p className="font-mono text-sm">
            {tLocal("thaiCost.pattaniHandling.colCrates")} {dispatchTotals.crateQty}{" "}
            / {tLocal("thaiCost.pattaniHandling.colBoxes")}{" "}
            {dispatchTotals.boxQty}
          </p>
        )}
      </div>

      {(existingRow || !loadingDispatch) && (
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
                : tLocal("thaiCost.handling.notSavedYet")}
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
                : tLocal("thaiCost.handling.notSavedYet")}
            </p>
          </div>
        </div>
      )}

      <StationTripsDisplay
        date={date}
        station="PATTANI"
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
        </form>
      )}

      <HandlingHistoryLink station="pattani" date={date} />
    </section>
  );
}

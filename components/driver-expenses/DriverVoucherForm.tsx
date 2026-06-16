"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DriverVoucherPrintArea,
  fetchVoucherPrintBreakdown,
} from "@/components/driver-expenses/DriverVoucherPrintArea";
import {
  formatMyr,
  parseOptionalNumber,
  roundMoney,
  sumActualBelanja,
  sumSuggestedAmounts,
  VOUCHER_LABELS,
  VOUCHER_LINE_ITEMS,
  type DriverVoucherData,
  type VoucherPrintBreakdown,
} from "@/lib/driver-expense/voucher-utils";
import { cn } from "@/lib/utils";
import "./driver-expense-print.css";

interface VoucherFormState {
  tripId: string;
  voucherNo: string;
  chopBorderAmt: string;
  chopBorderActual: string;
  parkingAmt: string;
  parkingActual: string;
  kpbAmt: string;
  kpbActual: string;
  fishCheckAmt: string;
  fishCheckActual: string;
  upahTurunAmt: string;
  upahTurunActual: string;
  upahNaikTongAmt: string;
  upahNaikTongActual: string;
  minyakMotoEnabled: boolean;
  minyakMotoAmt: string;
  minyakMotoActual: string;
  otherActual: string;
  duitJalan: string;
  lorry: string;
  driverName: string;
  route: string;
  tripDate: string;
}

interface DispatchOption {
  id: string;
  lorry: string;
  driver: string;
  route: string;
  date: string;
}

interface DriverVoucherFormProps {
  mode: "new" | "edit";
  date: string;
  voucherId?: string;
  initialTripId?: string;
}

function suggestionToForm(
  s: {
    tripId: string;
    tripDate: string;
    lorry: string;
    driverName: string;
    route: string;
    chopBorderAmt: number;
    parkingAmt: number;
    kpbAmt: number;
    fishCheckAmt: number;
    upahTurunAmt: number;
    upahNaikTongAmt: number;
  },
  voucherNo: string
): VoucherFormState {
  return {
    tripId: s.tripId,
    voucherNo,
    chopBorderAmt: String(s.chopBorderAmt),
    chopBorderActual: "",
    parkingAmt: String(s.parkingAmt),
    parkingActual: "",
    kpbAmt: String(s.kpbAmt),
    kpbActual: "",
    fishCheckAmt: String(s.fishCheckAmt),
    fishCheckActual: "",
    upahTurunAmt: String(s.upahTurunAmt),
    upahTurunActual: "",
    upahNaikTongAmt: String(s.upahNaikTongAmt),
    upahNaikTongActual: "",
    minyakMotoEnabled: false,
    minyakMotoAmt: "8",
    minyakMotoActual: "",
    otherActual: "",
    duitJalan: "",
    lorry: s.lorry,
    driverName: s.driverName,
    route: s.route,
    tripDate: s.tripDate,
  };
}

function voucherToForm(v: DriverVoucherData): VoucherFormState {
  return {
    tripId: v.tripId,
    voucherNo: v.voucherNo,
    chopBorderAmt: String(v.chopBorderAmt ?? ""),
    chopBorderActual: String(v.chopBorderActual ?? ""),
    parkingAmt: String(v.parkingAmt ?? ""),
    parkingActual: String(v.parkingActual ?? ""),
    kpbAmt: String(v.kpbAmt ?? ""),
    kpbActual: String(v.kpbActual ?? ""),
    fishCheckAmt: String(v.fishCheckAmt ?? ""),
    fishCheckActual: String(v.fishCheckActual ?? ""),
    upahTurunAmt: String(v.upahTurunAmt ?? ""),
    upahTurunActual: String(v.upahTurunActual ?? ""),
    upahNaikTongAmt: String(v.upahNaikTongAmt ?? ""),
    upahNaikTongActual: String(v.upahNaikTongActual ?? ""),
    minyakMotoEnabled: v.minyakMotoEnabled,
    minyakMotoAmt: String(v.minyakMotoAmt ?? "8"),
    minyakMotoActual: String(v.minyakMotoActual ?? ""),
    otherActual: String(v.otherActual ?? ""),
    duitJalan: String(v.duitJalan ?? ""),
    lorry: v.lorry,
    driverName: v.driverName,
    route: v.route,
    tripDate: v.tripDate,
  };
}

function formToPrintData(form: VoucherFormState, belanja: number, baki: number | null): DriverVoucherData {
  return {
    voucherNo: form.voucherNo,
    tripId: form.tripId,
    tripDate: form.tripDate,
    lorry: form.lorry,
    driverName: form.driverName,
    route: form.route,
    chopBorderAmt: parseOptionalNumber(form.chopBorderAmt),
    chopBorderActual: parseOptionalNumber(form.chopBorderActual),
    parkingAmt: parseOptionalNumber(form.parkingAmt),
    parkingActual: parseOptionalNumber(form.parkingActual),
    kpbAmt: parseOptionalNumber(form.kpbAmt),
    kpbActual: parseOptionalNumber(form.kpbActual),
    fishCheckAmt: parseOptionalNumber(form.fishCheckAmt),
    fishCheckActual: parseOptionalNumber(form.fishCheckActual),
    upahTurunAmt: parseOptionalNumber(form.upahTurunAmt),
    upahTurunActual: parseOptionalNumber(form.upahTurunActual),
    upahNaikTongAmt: parseOptionalNumber(form.upahNaikTongAmt),
    upahNaikTongActual: parseOptionalNumber(form.upahNaikTongActual),
    minyakMotoEnabled: form.minyakMotoEnabled,
    minyakMotoAmt: parseOptionalNumber(form.minyakMotoAmt) ?? 8,
    minyakMotoActual: parseOptionalNumber(form.minyakMotoActual),
    otherActual: parseOptionalNumber(form.otherActual),
    duitJalan: parseOptionalNumber(form.duitJalan),
    belanja,
    baki,
  };
}

export function DriverVoucherForm({
  mode,
  date,
  voucherId,
  initialTripId,
}: DriverVoucherFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<VoucherFormState | null>(null);
  const [dispatches, setDispatches] = useState<DispatchOption[]>([]);
  const [existingTripIds, setExistingTripIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(mode === "edit" || Boolean(initialTripId));
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printBreakdown, setPrintBreakdown] =
    useState<VoucherPrintBreakdown | null>(null);

  const backHref = `/documents/driver-expenses?date=${date}`;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        if (mode === "edit" && voucherId) {
          const res = await fetch(`/api/driver-vouchers/${voucherId}`);
          if (!res.ok) throw new Error("Gagal memuatkan baucar / Failed to load voucher");
          const data = (await res.json()) as { voucher?: DriverVoucherData & { tripDate: string } };
          if (!data.voucher) throw new Error("Baucar tidak wujud / Voucher not found");
          if (!cancelled) {
            setForm(
              voucherToForm({
                ...data.voucher,
                tripDate:
                  typeof data.voucher.tripDate === "string"
                    ? data.voucher.tripDate.slice(0, 10)
                    : date,
              })
            );
          }
          return;
        }

        const qs = new URLSearchParams({ startDate: date, endDate: date });
        const [dispatchRes, voucherRes] = await Promise.all([
          fetch(`/api/driver-expenses/dispatches?date=${date}`),
          fetch(`/api/driver-vouchers?${qs}`),
        ]);

        if (!dispatchRes.ok) throw new Error("Gagal memuatkan trip / Failed to load trips");
        const dispatchData = (await dispatchRes.json()) as {
          dispatches?: DispatchOption[];
        };
        const voucherData = voucherRes.ok
          ? ((await voucherRes.json()) as {
              vouchers?: { tripId: string }[];
            })
          : { vouchers: [] };

        if (cancelled) return;

        setDispatches(dispatchData.dispatches ?? []);
        setExistingTripIds(
          new Set((voucherData.vouchers ?? []).map((v) => v.tripId))
        );

        if (initialTripId) {
          await loadSuggestion(initialTripId, cancelled);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Gagal memuatkan / Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadSuggestion(tripId: string, cancelled: boolean) {
      setPreparing(true);
      try {
        const [prepRes, noRes] = await Promise.all([
          fetch("/api/driver-vouchers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prepareTripId: tripId }),
          }),
          fetch(`/api/driver-vouchers/voucher-no?tripDate=${date}`),
        ]);
        if (!prepRes.ok || !noRes.ok) throw new Error("Tidak dapat cadangan / Cannot fetch suggestions");
        const prepData = (await prepRes.json()) as {
          suggestion?: Parameters<typeof suggestionToForm>[0];
        };
        const noData = (await noRes.json()) as { voucherNo?: string };
        if (!prepData.suggestion) throw new Error("Tiada data cadangan / No suggestion data");
        if (!cancelled) {
          setForm(
            suggestionToForm(prepData.suggestion, noData.voucherNo ?? "")
          );
        }
      } finally {
        if (!cancelled) setPreparing(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [mode, voucherId, initialTripId, date]);

  async function prepareVoucherForTrip(tripId: string) {
    setPreparing(true);
    setError(null);
    try {
      const [prepRes, noRes] = await Promise.all([
        fetch("/api/driver-vouchers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prepareTripId: tripId }),
        }),
        fetch(`/api/driver-vouchers/voucher-no?tripDate=${date}`),
      ]);
      if (!prepRes.ok || !noRes.ok) throw new Error("Tidak dapat cadangan / Cannot fetch suggestions");
      const prepData = (await prepRes.json()) as {
        suggestion?: Parameters<typeof suggestionToForm>[0];
      };
      const noData = (await noRes.json()) as { voucherNo?: string };
      if (!prepData.suggestion) throw new Error("Tiada data cadangan / No suggestion data");
      setForm(suggestionToForm(prepData.suggestion, noData.voucherNo ?? ""));
      router.replace(
        `/documents/driver-expenses/new?date=${date}&tripId=${tripId}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyediakan / Prepare failed");
    } finally {
      setPreparing(false);
    }
  }

  const belanja = useMemo(() => {
    if (!form) return 0;
    return sumActualBelanja({
      chopBorderActual: parseOptionalNumber(form.chopBorderActual),
      parkingActual: parseOptionalNumber(form.parkingActual),
      kpbActual: parseOptionalNumber(form.kpbActual),
      fishCheckActual: parseOptionalNumber(form.fishCheckActual),
      upahTurunActual: parseOptionalNumber(form.upahTurunActual),
      upahNaikTongActual: parseOptionalNumber(form.upahNaikTongActual),
      minyakMotoEnabled: form.minyakMotoEnabled,
      minyakMotoActual: parseOptionalNumber(form.minyakMotoActual),
      otherActual: parseOptionalNumber(form.otherActual),
    });
  }, [form]);

  const suggestedSubtotal = useMemo(() => {
    if (!form) return 0;
    return sumSuggestedAmounts({
      chopBorderAmt: parseOptionalNumber(form.chopBorderAmt),
      parkingAmt: parseOptionalNumber(form.parkingAmt),
      kpbAmt: parseOptionalNumber(form.kpbAmt),
      fishCheckAmt: parseOptionalNumber(form.fishCheckAmt),
      upahTurunAmt: parseOptionalNumber(form.upahTurunAmt),
      upahNaikTongAmt: parseOptionalNumber(form.upahNaikTongAmt),
      minyakMotoEnabled: form.minyakMotoEnabled,
      minyakMotoAmt: parseOptionalNumber(form.minyakMotoAmt) ?? 8,
    });
  }, [form]);

  const duitJalan = form ? parseOptionalNumber(form.duitJalan) : null;
  const baki =
    duitJalan != null ? roundMoney(duitJalan - belanja) : null;

  async function saveVoucher() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        tripId: form.tripId,
        voucherNo: form.voucherNo,
        chopBorderAmt: parseOptionalNumber(form.chopBorderAmt),
        chopBorderActual: parseOptionalNumber(form.chopBorderActual),
        parkingAmt: parseOptionalNumber(form.parkingAmt),
        parkingActual: parseOptionalNumber(form.parkingActual),
        kpbAmt: parseOptionalNumber(form.kpbAmt),
        kpbActual: parseOptionalNumber(form.kpbActual),
        fishCheckAmt: parseOptionalNumber(form.fishCheckAmt),
        fishCheckActual: parseOptionalNumber(form.fishCheckActual),
        upahTurunAmt: parseOptionalNumber(form.upahTurunAmt),
        upahTurunActual: parseOptionalNumber(form.upahTurunActual),
        upahNaikTongAmt: parseOptionalNumber(form.upahNaikTongAmt),
        upahNaikTongActual: parseOptionalNumber(form.upahNaikTongActual),
        minyakMotoEnabled: form.minyakMotoEnabled,
        minyakMotoAmt: parseOptionalNumber(form.minyakMotoAmt) ?? 8,
        minyakMotoActual: parseOptionalNumber(form.minyakMotoActual),
        otherActual: parseOptionalNumber(form.otherActual),
        duitJalan: parseOptionalNumber(form.duitJalan),
      };

      const url =
        mode === "edit" && voucherId
          ? `/api/driver-vouchers/${voucherId}`
          : "/api/driver-vouchers";
      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Gagal menyimpan / Save failed");
      }
      router.push(backHref);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan / Save failed");
    } finally {
      setSaving(false);
    }
  }

  const printData = form ? formToPrintData(form, belanja, baki) : null;
  const availableTrips = dispatches.filter((d) => !existingTripIds.has(d.id));

  useEffect(() => {
    if (!form?.tripId) {
      setPrintBreakdown(null);
      return;
    }
    let cancelled = false;
    void fetchVoucherPrintBreakdown(form.tripId).then((breakdown) => {
      if (!cancelled) setPrintBreakdown(breakdown);
    });
    return () => {
      cancelled = true;
    };
  }, [form?.tripId]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-input px-2.5 text-sm hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          {VOUCHER_LABELS.kembali}
        </Link>
        <h2 className="text-xl font-bold text-haidee-text">
          {mode === "edit"
            ? VOUCHER_LABELS.editVoucher
            : VOUCHER_LABELS.newVoucher}
        </h2>
      </div>

      {error && (
        <p className="no-print rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-haidee-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuatkan… / Loading…
        </div>
      )}

      {!loading && !form && mode === "new" && (
        <section className="no-print rounded-xl border border-haidee-border bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold">{VOUCHER_LABELS.selectTrip}</h3>
          {preparing ? (
            <div className="flex items-center gap-2 text-sm text-haidee-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuatkan cadangan… / Loading suggestions…
            </div>
          ) : availableTrips.length === 0 ? (
            <p className="text-sm text-haidee-muted">
              Tiada trip tersedia pada tarikh ini / No trips available for this date
            </p>
          ) : (
            <div className="space-y-1">
              {availableTrips.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => prepareVoucherForTrip(d.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-haidee-border px-3 py-2 text-left text-sm hover:bg-haidee-surface/50"
                >
                  <span className="font-medium">{d.lorry}</span>
                  <span className="text-haidee-muted">{d.driver}</span>
                  <span className="text-haidee-muted">{d.route}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {form && (
        <>
          <section className="no-print space-y-4 rounded-xl border border-haidee-border bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-xs text-haidee-muted">{VOUCHER_LABELS.nama}</p>
                <p className="font-medium">{form.driverName}</p>
              </div>
              <div>
                <p className="text-xs text-haidee-muted">{VOUCHER_LABELS.noLorry}</p>
                <p className="font-medium">{form.lorry}</p>
              </div>
              <div>
                <p className="text-xs text-haidee-muted">{VOUCHER_LABELS.tarikh}</p>
                <p className="font-medium">{form.tripDate}</p>
              </div>
              <div>
                <p className="text-xs text-haidee-muted">{VOUCHER_LABELS.trip}</p>
                <p className="font-medium">{form.route}</p>
              </div>
              <div>
                <p className="text-xs text-haidee-muted">{VOUCHER_LABELS.voucherNo}</p>
                <p className="font-mono font-medium">{form.voucherNo}</p>
              </div>
            </div>

            <div className="rounded-lg border border-haidee-border bg-haidee-surface/30 p-4">
              <label className="mb-2 block text-sm font-semibold">
                {VOUCHER_LABELS.duitJalan}
              </label>
              <Input
                type="number"
                step="0.01"
                className="max-w-xs text-right font-mono text-lg font-semibold"
                value={form.duitJalan}
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, duitJalan: e.target.value } : prev
                  )
                }
              />
            </div>

            <div className="grid grid-cols-3 gap-3 border-b border-haidee-border pb-2 text-sm font-medium">
              <div>{VOUCHER_LABELS.perkara}</div>
              <div className="text-right">{VOUCHER_LABELS.cadangan}</div>
              <div className="text-right">{VOUCHER_LABELS.sebenar}</div>
            </div>

            {VOUCHER_LINE_ITEMS.map(({ label, amtKey, actualKey }) => (
              <div key={amtKey} className="grid grid-cols-3 items-center gap-3">
                <label className="text-sm">{label}</label>
                <Input
                  readOnly
                  className="bg-muted/50 text-right font-mono"
                  value={form[amtKey]}
                />
                <Input
                  type="number"
                  step="0.01"
                  className="text-right font-mono"
                  value={form[actualKey]}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, [actualKey]: e.target.value } : prev
                    )
                  }
                />
              </div>
            ))}

            <div className="grid grid-cols-3 items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="minyakMoto"
                  checked={form.minyakMotoEnabled}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev
                        ? { ...prev, minyakMotoEnabled: e.target.checked }
                        : prev
                    )
                  }
                />
                <label htmlFor="minyakMoto" className="text-sm">
                  {VOUCHER_LABELS.minyakMoto}
                </label>
              </div>
              <Input
                readOnly
                className="bg-muted/50 text-right font-mono"
                value={form.minyakMotoAmt}
              />
              <Input
                type="number"
                step="0.01"
                className="text-right font-mono"
                value={form.minyakMotoActual}
                disabled={!form.minyakMotoEnabled}
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, minyakMotoActual: e.target.value } : prev
                  )
                }
              />
            </div>

            <div className="grid grid-cols-3 items-center gap-3">
              <label className="text-sm">{VOUCHER_LABELS.lainLain}</label>
              <Input
                readOnly
                className="bg-muted/50 text-right font-mono"
                value=""
                tabIndex={-1}
              />
              <Input
                type="number"
                step="0.01"
                className="text-right font-mono"
                value={form.otherActual}
                onChange={(e) =>
                  setForm((prev) =>
                    prev ? { ...prev, otherActual: e.target.value } : prev
                  )
                }
              />
            </div>

            <div className="grid grid-cols-3 items-center gap-3 border-t border-haidee-border pt-3 font-semibold">
              <div>{VOUCHER_LABELS.subtotal}</div>
              <div className="text-right font-mono">
                {formatMyr(suggestedSubtotal)}
              </div>
              <div className="text-right font-mono">{formatMyr(belanja)}</div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-haidee-surface/40 px-4 py-3 text-sm">
              <span>
                {VOUCHER_LABELS.belanja}:{" "}
                <span className="font-mono font-semibold">
                  {formatMyr(belanja)}
                </span>
              </span>
              <span>
                {VOUCHER_LABELS.baki}:{" "}
                <span
                  className={cn(
                    "font-mono font-semibold",
                    baki != null && baki >= 0 && "text-green-600",
                    baki != null && baki < 0 && "text-red-600"
                  )}
                >
                  {baki != null ? formatMyr(baki) : "—"}
                </span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveVoucher} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  VOUCHER_LABELS.simpan
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
                {VOUCHER_LABELS.cetak}
              </Button>
              <Link
                href={backHref}
                className="inline-flex h-8 items-center rounded-lg border border-input px-2.5 text-sm hover:bg-accent"
              >
                {VOUCHER_LABELS.batal}
              </Link>
            </div>
          </section>

          {printData && (
            <DriverVoucherPrintArea
              voucher={printData}
              breakdown={printBreakdown}
            />
          )}
        </>
      )}
    </div>
  );
}

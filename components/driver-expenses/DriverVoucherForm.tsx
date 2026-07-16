"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  sumCharterSuggestedAmounts,
  sumSuggestedAmounts,
  hasVoucherSettlementActuals,
  isAdvancePendingSettlement,
  VOUCHER_LABELS,
  type DriverVoucherData,
  type VoucherMarketActualData,
  type VoucherPrintBreakdown,
} from "@/lib/driver-expense/voucher-utils";
import {
  buildMarketActualInputsFromForm,
  getMarketActualFormValue,
  hydrateMarketActualFormMap,
  marketActualFormKey,
  marketActualFormMapToDto,
  sumMarketActualFormValues,
  type MarketActualFormMap,
} from "@/lib/driver-expense/market-actuals-form";
import { isKpbDisabledMarket } from "@/lib/driver-expense/constants";
import { formatKpbFeeRowLabel } from "@/lib/driver-expense/fee-labels";
import { useT } from "@/components/shared/locale-context";
import { canWriteDriverVoucher } from "@/lib/auth-roles";
import {
  isVoucherStatus,
  type VoucherStatus,
} from "@/lib/driver-voucher-status-types";
import type { StoredUserRole } from "@/types";
import { formatDisplay } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import {
  expenseTripKey,
  type DriverVoucherTripSource,
} from "@/lib/driver-expense/trip-source";
import { VoucherChangeLogTimeline, type VoucherChangeLogEntry } from "./VoucherChangeLogTimeline";
import { VoucherDecisionPanel } from "./VoucherDecisionPanel";
import { VoucherReviewPanel } from "./VoucherReviewPanel";
import { VoucherStatusBadge } from "./VoucherStatusBadge";
import "./driver-expense-print.css";

interface VoucherFormState {
  tripId: string;
  tripSource: DriverVoucherTripSource;
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
  date?: string;
  tripSource?: DriverVoucherTripSource;
  charterNo?: string | null;
}

interface DriverVoucherFormProps {
  mode: "new" | "edit";
  date: string;
  voucherId?: string;
  initialTripId?: string;
  initialTripSource?: DriverVoucherTripSource;
  userRole: StoredUserRole;
}

interface VoucherWorkflowMeta {
  status: VoucherStatus;
  clerkNote: string | null;
  reviewNote: string | null;
}

function defaultWorkflowMeta(): VoucherWorkflowMeta {
  return { status: "draft", clerkNote: null, reviewNote: null };
}

function workflowFromVoucher(v: DriverVoucherData): VoucherWorkflowMeta {
  const status =
    v.status && isVoucherStatus(v.status) ? v.status : "draft";
  return {
    status,
    clerkNote: v.clerkNote ?? null,
    reviewNote: v.reviewNote ?? null,
  };
}

function canEditVoucherFields(
  status: VoucherStatus,
  role: StoredUserRole,
  mode: "new" | "edit"
): boolean {
  if (!canWriteDriverVoucher(role)) return false;
  if (mode === "new") return true;
  return (
    status === "draft" || status === "clerk_entered" || status === "rejected"
  );
}

const MARKET_ORDER = ["KL", "MC", "A", "BM", "BM Pindah", "KD"] as const;

function suggestionToForm(
  s: {
    tripId: string;
    tripSource?: DriverVoucherTripSource;
    tripDate: string;
    lorry: string;
    driverName: string;
    route: string;
    chopBorderAmt: number | null;
    parkingAmt: number | null;
    kpbAmt: number | null;
    fishCheckAmt: number | null;
    upahTurunAmt: number | null;
    upahNaikTongAmt: number | null;
  },
  voucherNo: string,
  tripSource: DriverVoucherTripSource
): VoucherFormState {
  return {
    tripId: s.tripId,
    tripSource,
    voucherNo,
    chopBorderAmt: String(s.chopBorderAmt ?? ""),
    chopBorderActual: "",
    parkingAmt: String(s.parkingAmt ?? ""),
    parkingActual: "",
    kpbAmt: String(s.kpbAmt ?? ""),
    kpbActual: "",
    fishCheckAmt: String(s.fishCheckAmt ?? ""),
    fishCheckActual: "",
    upahTurunAmt: String(s.upahTurunAmt ?? ""),
    upahTurunActual: "",
    upahNaikTongAmt: String(s.upahNaikTongAmt ?? ""),
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

function voucherToForm(
  v: DriverVoucherData,
  tripSource: DriverVoucherTripSource
): VoucherFormState {
  return {
    tripId: v.tripId,
    tripSource,
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

function formToPrintData(
  form: VoucherFormState,
  belanja: number,
  baki: number | null,
  marketActuals: MarketActualFormMap,
  breakdown: VoucherPrintBreakdown | null
): DriverVoucherData {
  const isCharter = form.tripSource === "charter";
  const parkingActual = isCharter
    ? null
    : sumMarketActualFormValues(marketActuals, "parking") ??
      parseOptionalNumber(form.parkingActual);
  const kpbActual = isCharter
    ? null
    : sumMarketActualFormValues(marketActuals, "kpb") ??
      parseOptionalNumber(form.kpbActual);
  const upahTurunActual = isCharter
    ? parseOptionalNumber(form.upahTurunActual)
    : sumMarketActualFormValues(marketActuals, "unload") ??
      parseOptionalNumber(form.upahTurunActual);

  return {
    voucherNo: form.voucherNo,
    tripId: form.tripId,
    tripSource: form.tripSource,
    tripDate: form.tripDate,
    lorry: form.lorry,
    driverName: form.driverName,
    route: form.route,
    chopBorderAmt: parseOptionalNumber(form.chopBorderAmt),
    chopBorderActual: parseOptionalNumber(form.chopBorderActual),
    parkingAmt: parseOptionalNumber(form.parkingAmt),
    parkingActual,
    kpbAmt: parseOptionalNumber(form.kpbAmt),
    kpbActual,
    fishCheckAmt: parseOptionalNumber(form.fishCheckAmt),
    fishCheckActual: parseOptionalNumber(form.fishCheckActual),
    upahTurunAmt: parseOptionalNumber(form.upahTurunAmt),
    upahTurunActual,
    upahNaikTongAmt: parseOptionalNumber(form.upahNaikTongAmt),
    upahNaikTongActual: parseOptionalNumber(form.upahNaikTongActual),
    minyakMotoEnabled: form.minyakMotoEnabled,
    minyakMotoAmt: parseOptionalNumber(form.minyakMotoAmt) ?? 8,
    minyakMotoActual: parseOptionalNumber(form.minyakMotoActual),
    otherActual: parseOptionalNumber(form.otherActual),
    duitJalan: parseOptionalNumber(form.duitJalan),
    belanja,
    baki,
    marketActuals: isCharter
      ? undefined
      : marketActualFormMapToDto(marketActuals, breakdown),
  };
}

function updateMarketActualCell(
  map: MarketActualFormMap,
  feeType: "parking" | "kpb" | "unload",
  displayMarket: string,
  value: string
): MarketActualFormMap {
  return {
    ...map,
    [marketActualFormKey(feeType, displayMarket)]: value,
  };
}

export function DriverVoucherForm({
  mode,
  date,
  voucherId,
  initialTripId,
  initialTripSource = "dispatch",
  userRole,
}: DriverVoucherFormProps) {
  const router = useRouter();
  const { t, locale } = useT();
  const [form, setForm] = useState<VoucherFormState | null>(null);
  const [workflow, setWorkflow] = useState<VoucherWorkflowMeta>(defaultWorkflowMeta);
  const [changeLogs, setChangeLogs] = useState<VoucherChangeLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [dispatches, setDispatches] = useState<DispatchOption[]>([]);
  const [existingTripIds, setExistingTripIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(mode === "edit" || Boolean(initialTripId));
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [clerkNote, setClerkNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [printBreakdown, setPrintBreakdown] =
    useState<VoucherPrintBreakdown | null>(null);
  const [marketActuals, setMarketActuals] = useState<MarketActualFormMap>({});
  const hydrateSourceRef = useRef<{
    tripId: string;
    rows: VoucherMarketActualData[];
    scalars: {
      parkingActual?: number | null;
      kpbActual?: number | null;
      upahTurunActual?: number | null;
    };
  } | null>(null);
  const hydratedTripRef = useRef<string | null>(null);

  const backHref = `/documents/driver-expenses?date=${date}&refresh=1`;
  const formEditable = canEditVoucherFields(workflow.status, userRole, mode);
  const settlementEmpty = useMemo(() => {
    if (!form) return true;
    const tripSource = form.tripSource === "charter" ? "charter" : "dispatch";
    if (tripSource === "charter") {
      return !hasVoucherSettlementActuals(
        {
          chopBorderActual: parseOptionalNumber(form.chopBorderActual),
          parkingActual: null,
          kpbActual: null,
          fishCheckActual: null,
          upahTurunActual: parseOptionalNumber(form.upahTurunActual),
          upahNaikTongActual: parseOptionalNumber(form.upahNaikTongActual),
          minyakMotoEnabled: form.minyakMotoEnabled,
          minyakMotoActual: parseOptionalNumber(form.minyakMotoActual),
          otherActual: parseOptionalNumber(form.otherActual),
        },
        { tripSource: "charter" }
      );
    }
    const parkingActual =
      sumMarketActualFormValues(marketActuals, "parking") ??
      parseOptionalNumber(form.parkingActual);
    const kpbActual =
      sumMarketActualFormValues(marketActuals, "kpb") ??
      parseOptionalNumber(form.kpbActual);
    const upahTurunActual =
      sumMarketActualFormValues(marketActuals, "unload") ??
      parseOptionalNumber(form.upahTurunActual);
    return !hasVoucherSettlementActuals({
      chopBorderActual: parseOptionalNumber(form.chopBorderActual),
      parkingActual,
      kpbActual,
      fishCheckActual: parseOptionalNumber(form.fishCheckActual),
      upahTurunActual,
      upahNaikTongActual: parseOptionalNumber(form.upahNaikTongActual),
      minyakMotoEnabled: form.minyakMotoEnabled,
      minyakMotoActual: parseOptionalNumber(form.minyakMotoActual),
      otherActual: parseOptionalNumber(form.otherActual),
    });
  }, [form, marketActuals]);

  const canShowEntryActions =
    formEditable &&
    Boolean(form) &&
    (mode === "new" ||
      workflow.status === "draft" ||
      workflow.status === "rejected");
  /** Advance-only when no Actuals yet — hides confirm to block zero-settlement confirms. */
  const showAdvanceOnlyButton = canShowEntryActions && settlementEmpty;
  const showFinalizeButtons = canShowEntryActions && !settlementEmpty;
  const showDecisionPanel =
    workflow.status === "clerk_entered" && canWriteDriverVoucher(userRole);
  const showReviewPanel =
    workflow.status === "pending_review" && userRole === "admin";
  const showReopenButton =
    mode === "edit" &&
    Boolean(voucherId) &&
    userRole === "admin" &&
    (workflow.status === "confirmed" || workflow.status === "approved");
  const workflowBusyAny = saving || workflowBusy;
  const advancePendingLabel = isAdvancePendingSettlement({
    status: workflow.status,
    duitJalan: form ? parseOptionalNumber(form.duitJalan) : null,
    chopBorderActual: form
      ? parseOptionalNumber(form.chopBorderActual)
      : null,
    parkingActual: form ? parseOptionalNumber(form.parkingActual) : null,
    kpbActual: form ? parseOptionalNumber(form.kpbActual) : null,
    fishCheckActual: form ? parseOptionalNumber(form.fishCheckActual) : null,
    upahTurunActual: form ? parseOptionalNumber(form.upahTurunActual) : null,
    upahNaikTongActual: form
      ? parseOptionalNumber(form.upahNaikTongActual)
      : null,
    minyakMotoEnabled: form?.minyakMotoEnabled ?? false,
    minyakMotoActual: form ? parseOptionalNumber(form.minyakMotoActual) : null,
    otherActual: form ? parseOptionalNumber(form.otherActual) : null,
  });

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
            const voucher = {
              ...data.voucher,
              tripDate:
                typeof data.voucher.tripDate === "string"
                  ? data.voucher.tripDate.slice(0, 10)
                  : date,
            };
            hydrateSourceRef.current = {
              tripId: voucher.tripId,
              rows: voucher.marketActuals ?? [],
              scalars: {
                parkingActual: voucher.parkingActual,
                kpbActual: voucher.kpbActual,
                upahTurunActual: voucher.upahTurunActual,
              },
            };
            hydratedTripRef.current = null;
            setMarketActuals({});
            setForm(
              voucherToForm(
                voucher,
                voucher.tripSource === "charter" ? "charter" : "dispatch"
              )
            );
            setWorkflow(workflowFromVoucher(voucher));
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
          trips?: DispatchOption[];
        };
        const voucherData = voucherRes.ok
          ? ((await voucherRes.json()) as {
              vouchers?: { tripId: string; tripSource?: string }[];
            })
          : { vouchers: [] };

        if (cancelled) return;

        const tripList = dispatchData.trips ?? dispatchData.dispatches ?? [];
        setDispatches(tripList);
        setExistingTripIds(
          new Set(
            (voucherData.vouchers ?? []).map((v) =>
              expenseTripKey(
                v.tripId,
                v.tripSource === "charter" ? "charter" : "dispatch"
              )
            )
          )
        );

        if (initialTripId) {
          await loadSuggestion(initialTripId, initialTripSource, cancelled);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Gagal memuatkan / Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadSuggestion(
      tripId: string,
      tripSource: DriverVoucherTripSource,
      cancelled: boolean
    ) {
      setPreparing(true);
      try {
        const [prepRes, noRes] = await Promise.all([
          fetch("/api/driver-vouchers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prepareTripId: tripId, prepareTripSource: tripSource }),
          }),
          fetch(`/api/driver-vouchers/voucher-no?tripDate=${date}`),
        ]);
        if (!prepRes.ok || !noRes.ok) throw new Error("Tidak dapat cadangan / Cannot fetch suggestions");
        const prepData = (await prepRes.json()) as {
          suggestion?: Parameters<typeof suggestionToForm>[0];
          tripSource?: DriverVoucherTripSource;
        };
        const noData = (await noRes.json()) as { voucherNo?: string };
        if (!prepData.suggestion) throw new Error("Tiada data cadangan / No suggestion data");
        const resolvedSource =
          prepData.tripSource === "charter" || tripSource === "charter"
            ? "charter"
            : "dispatch";
        if (!cancelled) {
          setForm(
            suggestionToForm(
              prepData.suggestion,
              noData.voucherNo ?? "",
              resolvedSource
            )
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
  }, [mode, voucherId, initialTripId, initialTripSource, date]);

  useEffect(() => {
    if (mode !== "edit" || !voucherId) return;
    let cancelled = false;
    async function loadLogs() {
      setLogsLoading(true);
      try {
        const res = await fetch(`/api/driver-vouchers/${voucherId}/change-logs`);
        if (!res.ok) return;
        const data = (await res.json()) as { logs?: VoucherChangeLogEntry[] };
        if (!cancelled) setChangeLogs(data.logs ?? []);
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    }
    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [mode, voucherId]);

  async function reloadVoucher(id: string) {
    const res = await fetch(`/api/driver-vouchers/${id}`);
    if (!res.ok) throw new Error("Gagal memuatkan baucar / Failed to reload voucher");
    const data = (await res.json()) as {
      voucher?: DriverVoucherData & { tripDate: string };
    };
    if (!data.voucher) throw new Error("Baucar tidak wujud / Voucher not found");
    const voucher = {
      ...data.voucher,
      tripDate:
        typeof data.voucher.tripDate === "string"
          ? data.voucher.tripDate.slice(0, 10)
          : date,
    };
    hydrateSourceRef.current = {
      tripId: voucher.tripId,
      rows: voucher.marketActuals ?? [],
      scalars: {
        parkingActual: voucher.parkingActual,
        kpbActual: voucher.kpbActual,
        upahTurunActual: voucher.upahTurunActual,
      },
    };
    hydratedTripRef.current = null;
    setMarketActuals({});
    setForm(
      voucherToForm(
        voucher,
        voucher.tripSource === "charter" ? "charter" : "dispatch"
      )
    );
    setWorkflow(workflowFromVoucher(voucher));
  }

  async function reloadChangeLogs(id: string) {
    const res = await fetch(`/api/driver-vouchers/${id}/change-logs`);
    if (!res.ok) return;
    const data = (await res.json()) as { logs?: VoucherChangeLogEntry[] };
    setChangeLogs(data.logs ?? []);
  }

  function buildSavePayload(options?: {
    submitEntry?: boolean;
    recordAdvanceOnly?: boolean;
  }) {
    if (!form) throw new Error("Form not ready");
    const isCharter = form.tripSource === "charter";
    const parkingActual = isCharter
      ? null
      : sumMarketActualFormValues(marketActuals, "parking") ??
        parseOptionalNumber(form.parkingActual);
    const kpbActual = isCharter
      ? null
      : sumMarketActualFormValues(marketActuals, "kpb") ??
        parseOptionalNumber(form.kpbActual);
    const upahTurunActual = isCharter
      ? parseOptionalNumber(form.upahTurunActual)
      : sumMarketActualFormValues(marketActuals, "unload") ??
        parseOptionalNumber(form.upahTurunActual);
    const marketActualInputs = isCharter
      ? []
      : buildMarketActualInputsFromForm(marketActuals, printBreakdown);

    return {
      tripId: form.tripId,
      tripSource: form.tripSource,
      voucherNo: form.voucherNo,
      chopBorderAmt: parseOptionalNumber(form.chopBorderAmt),
      chopBorderActual: parseOptionalNumber(form.chopBorderActual),
      parkingAmt: parseOptionalNumber(form.parkingAmt),
      parkingActual,
      kpbAmt: parseOptionalNumber(form.kpbAmt),
      kpbActual,
      fishCheckAmt: parseOptionalNumber(form.fishCheckAmt),
      fishCheckActual: parseOptionalNumber(form.fishCheckActual),
      upahTurunAmt: parseOptionalNumber(form.upahTurunAmt),
      upahTurunActual,
      upahNaikTongAmt: parseOptionalNumber(form.upahNaikTongAmt),
      upahNaikTongActual: parseOptionalNumber(form.upahNaikTongActual),
      minyakMotoEnabled: form.minyakMotoEnabled,
      minyakMotoAmt: parseOptionalNumber(form.minyakMotoAmt) ?? 8,
      minyakMotoActual: parseOptionalNumber(form.minyakMotoActual),
      otherActual: parseOptionalNumber(form.otherActual),
      duitJalan: parseOptionalNumber(form.duitJalan),
      marketActuals:
        marketActualInputs.length > 0 ? marketActualInputs : undefined,
      submitEntry: options?.submitEntry,
      recordAdvanceOnly: options?.recordAdvanceOnly,
    };
  }

  async function persistVoucher(options?: {
    submitEntry?: boolean;
    recordAdvanceOnly?: boolean;
    stayOnPage?: boolean;
  }): Promise<string> {
    if (!form) throw new Error("Form not ready");
    const payload = buildSavePayload({
      submitEntry: options?.submitEntry,
      recordAdvanceOnly: options?.recordAdvanceOnly,
    });

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
    const data = (await res.json()) as { voucher?: { id: string } };
    const id = data.voucher?.id ?? voucherId;
    if (!id) throw new Error("Gagal menyimpan / Save failed");

    if (options?.stayOnPage) {
      await reloadVoucher(id);
      await reloadChangeLogs(id);
      router.refresh();
    }

    return id;
  }

  async function transitionVoucherById(
    id: string,
    toStatus: VoucherStatus,
    note?: string
  ) {
    const res = await fetch(`/api/driver-vouchers/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus, note }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? t("driverExpenses.form.transitionFailed"));
    }
  }

  async function transitionVoucher(toStatus: VoucherStatus, note?: string) {
    if (!voucherId) throw new Error("Voucher ID required");
    await transitionVoucherById(voucherId, toStatus, note);
  }

  async function submitAdvanceOnly() {
    if (!form) return;
    const duit = parseOptionalNumber(form.duitJalan);
    if (duit == null || !(duit > 0)) {
      setError(t("driverExpenses.form.advanceRequiresDuitJalan"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await persistVoucher({
        recordAdvanceOnly: true,
        submitEntry: false,
        stayOnPage: false,
      });
      router.push(`/documents/driver-expenses/${id}?date=${date}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan / Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitAndFinalize(
    toStatus: "confirmed" | "pending_review",
    note?: string
  ) {
    if (!form) return;
    if (toStatus === "pending_review" && (!note || !note.trim())) {
      setError(t("driverExpenses.form.flagNoteRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await persistVoucher({ submitEntry: true, stayOnPage: false });
      try {
        await transitionVoucherById(id, toStatus, note?.trim());
      } catch (transitionError) {
        router.replace(`/documents/driver-expenses/${id}?date=${date}`);
        setError(
          transitionError instanceof Error
            ? transitionError.message
            : t("driverExpenses.form.transitionFailed")
        );
        throw transitionError;
      }
      setShowFlagForm(false);
      setClerkNote("");
      router.push(backHref);
      router.refresh();
    } catch (e) {
      if (
        e instanceof Error &&
        e.message !== t("driverExpenses.form.transitionFailed") &&
        !error
      ) {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!voucherId) return;
    setWorkflowBusy(true);
    setError(null);
    try {
      await persistVoucher({ submitEntry: false, stayOnPage: false });
      await transitionVoucher("confirmed");
      await reloadVoucher(voucherId);
      await reloadChangeLogs(voucherId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败 / Action failed");
      throw e;
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function handleFlagForReview(note: string) {
    if (!voucherId) return;
    setWorkflowBusy(true);
    setError(null);
    try {
      await persistVoucher({ submitEntry: false, stayOnPage: false });
      await transitionVoucher("pending_review", note);
      await reloadVoucher(voucherId);
      await reloadChangeLogs(voucherId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败 / Action failed");
      throw e;
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function handleApprove(note?: string) {
    if (!voucherId) return;
    setWorkflowBusy(true);
    setError(null);
    try {
      await transitionVoucher("approved", note);
      await reloadVoucher(voucherId);
      await reloadChangeLogs(voucherId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败 / Action failed");
      throw e;
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function handleReject(note: string) {
    if (!voucherId) return;
    setWorkflowBusy(true);
    setError(null);
    try {
      await transitionVoucher("rejected", note);
      await reloadVoucher(voucherId);
      await reloadChangeLogs(voucherId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败 / Action failed");
      throw e;
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function handleReopen() {
    if (!voucherId) return;
    if (!window.confirm(t("driverExpenses.form.reopenConfirm"))) return;

    setWorkflowBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/driver-vouchers/${voucherId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? t("driverExpenses.form.reopenFailed"));
      }
      await reloadVoucher(voucherId);
      await reloadChangeLogs(voucherId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败 / Action failed");
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function prepareVoucherForTrip(trip: DispatchOption) {
    const tripSource = trip.tripSource ?? "dispatch";
    setPreparing(true);
    setError(null);
    try {
      const [prepRes, noRes] = await Promise.all([
        fetch("/api/driver-vouchers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prepareTripId: trip.id,
            prepareTripSource: tripSource,
          }),
        }),
        fetch(`/api/driver-vouchers/voucher-no?tripDate=${date}`),
      ]);
      if (!prepRes.ok || !noRes.ok) throw new Error("Tidak dapat cadangan / Cannot fetch suggestions");
      const prepData = (await prepRes.json()) as {
        suggestion?: Parameters<typeof suggestionToForm>[0];
        tripSource?: DriverVoucherTripSource;
      };
      const noData = (await noRes.json()) as { voucherNo?: string };
      if (!prepData.suggestion) throw new Error("Tiada data cadangan / No suggestion data");
      const resolvedSource =
        prepData.tripSource === "charter" || tripSource === "charter"
          ? "charter"
          : "dispatch";
      hydrateSourceRef.current = {
        tripId: trip.id,
        rows: [],
        scalars: {},
      };
      hydratedTripRef.current = null;
      setMarketActuals({});
      setForm(
        suggestionToForm(
          prepData.suggestion,
          noData.voucherNo ?? "",
          resolvedSource
        )
      );
      const params = new URLSearchParams({ date, tripId: trip.id });
      if (resolvedSource === "charter") params.set("tripSource", "charter");
      router.replace(`/documents/driver-expenses/new?${params.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyediakan / Prepare failed");
    } finally {
      setPreparing(false);
    }
  }

  const isCharterMode = form?.tripSource === "charter";

  const belanja = useMemo(() => {
    if (!form) return 0;
    if (isCharterMode) {
      return sumActualBelanja(
        {
          chopBorderActual: parseOptionalNumber(form.chopBorderActual),
          parkingActual: null,
          kpbActual: null,
          fishCheckActual: null,
          upahTurunActual: parseOptionalNumber(form.upahTurunActual),
          upahNaikTongActual: parseOptionalNumber(form.upahNaikTongActual),
          minyakMotoEnabled: form.minyakMotoEnabled,
          minyakMotoActual: parseOptionalNumber(form.minyakMotoActual),
          otherActual: parseOptionalNumber(form.otherActual),
        },
        { tripSource: "charter" }
      );
    }
    const parkingActual =
      sumMarketActualFormValues(marketActuals, "parking") ??
      parseOptionalNumber(form.parkingActual);
    const kpbActual =
      sumMarketActualFormValues(marketActuals, "kpb") ??
      parseOptionalNumber(form.kpbActual);
    const upahTurunActual =
      sumMarketActualFormValues(marketActuals, "unload") ??
      parseOptionalNumber(form.upahTurunActual);
    return sumActualBelanja({
      chopBorderActual: parseOptionalNumber(form.chopBorderActual),
      parkingActual,
      kpbActual,
      fishCheckActual: parseOptionalNumber(form.fishCheckActual),
      upahTurunActual,
      upahNaikTongActual: parseOptionalNumber(form.upahNaikTongActual),
      minyakMotoEnabled: form.minyakMotoEnabled,
      minyakMotoActual: parseOptionalNumber(form.minyakMotoActual),
      otherActual: parseOptionalNumber(form.otherActual),
    });
  }, [form, marketActuals, isCharterMode]);

  const suggestedSubtotal = useMemo(() => {
    if (!form) return 0;
    if (isCharterMode) {
      return sumCharterSuggestedAmounts({
        chopBorderAmt: parseOptionalNumber(form.chopBorderAmt),
        upahTurunAmt: parseOptionalNumber(form.upahTurunAmt),
        upahNaikTongAmt: parseOptionalNumber(form.upahNaikTongAmt),
        minyakMotoEnabled: form.minyakMotoEnabled,
        minyakMotoAmt: parseOptionalNumber(form.minyakMotoAmt) ?? 8,
      });
    }
    const parkingSuggested =
      printBreakdown?.parking.length
        ? printBreakdown.parking.reduce((sum, row) => sum + row.suggested, 0)
        : parseOptionalNumber(form.parkingAmt) ?? 0;
    const kpbSuggested =
      printBreakdown?.kpb.length
        ? printBreakdown.kpb.reduce((sum, row) => sum + row.suggested, 0)
        : parseOptionalNumber(form.kpbAmt) ?? 0;
    const upahTurunSuggested =
      printBreakdown?.upahTurun.length
        ? printBreakdown.upahTurun.reduce((sum, row) => sum + row.suggested, 0)
        : parseOptionalNumber(form.upahTurunAmt) ?? 0;
    return sumSuggestedAmounts({
      chopBorderAmt: parseOptionalNumber(form.chopBorderAmt),
      parkingAmt: parkingSuggested,
      kpbAmt: kpbSuggested,
      fishCheckAmt: parseOptionalNumber(form.fishCheckAmt),
      upahTurunAmt: upahTurunSuggested,
      upahNaikTongAmt: parseOptionalNumber(form.upahNaikTongAmt),
      minyakMotoEnabled: form.minyakMotoEnabled,
      minyakMotoAmt: parseOptionalNumber(form.minyakMotoAmt) ?? 8,
    });
  }, [form, printBreakdown, isCharterMode]);

  const duitJalan = form ? parseOptionalNumber(form.duitJalan) : null;
  const baki =
    duitJalan != null ? roundMoney(duitJalan - belanja) : null;

  const printData = form
    ? formToPrintData(form, belanja, baki, marketActuals, printBreakdown)
    : null;
  const availableTrips = dispatches.filter(
    (d) => !existingTripIds.has(expenseTripKey(d.id, d.tripSource ?? "dispatch"))
  );

  useEffect(() => {
    if (!form?.tripId || isCharterMode) {
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
  }, [form?.tripId, isCharterMode]);

  useEffect(() => {
    if (!form?.tripId || !printBreakdown || isCharterMode) return;
    if (hydratedTripRef.current === form.tripId) return;

    const source = hydrateSourceRef.current;
    const rows =
      source?.tripId === form.tripId ? source.rows : [];
    const scalars =
      source?.tripId === form.tripId ? source.scalars : {};

    setMarketActuals(
      hydrateMarketActualFormMap(printBreakdown, rows, scalars)
    );
    hydratedTripRef.current = form.tripId;
  }, [form?.tripId, printBreakdown, isCharterMode]);

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <div className="no-print space-y-6">
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
        {mode === "edit" && (
          <VoucherStatusBadge
            status={workflow.status}
            advancePending={advancePendingLabel}
          />
        )}
      </div>

      {workflow.status === "rejected" && workflow.reviewNote && (
        <div className="no-print rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-semibold">{t("driverExpenses.form.rejectionBanner")}</p>
          <p className="mt-1 whitespace-pre-wrap">{workflow.reviewNote}</p>
        </div>
      )}

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
                  key={`${d.tripSource ?? "dispatch"}:${d.id}`}
                  type="button"
                  onClick={() => prepareVoucherForTrip(d)}
                  className="flex w-full items-center gap-2 rounded-lg border border-haidee-border px-3 py-2 text-left text-sm hover:bg-haidee-surface/50"
                >
                  <span className="font-medium">{d.lorry}</span>
                  <span className="text-haidee-muted">{d.driver}</span>
                  <span className="text-haidee-muted">{d.route}</span>
                  {(d.tripSource ?? "dispatch") === "charter" && (
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-800">
                      包车
                    </span>
                  )}
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
                <p className="font-medium">{formatDisplay(form.tripDate)}</p>
              </div>
              <div>
                <p className="text-xs text-haidee-muted">{VOUCHER_LABELS.trip}</p>
                <p className="font-medium">
                  {form.route}
                  {isCharterMode && (
                    <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-800">
                      包车
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-haidee-muted">{VOUCHER_LABELS.voucherNo}</p>
                <p className="font-mono font-medium">{form.voucherNo}</p>
              </div>
            </div>

            <fieldset
              disabled={!formEditable}
              className={cn(
                "space-y-4",
                !formEditable && "opacity-90"
              )}
            >
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

            {(() => {
              const parkingMap = new Map(
                (printBreakdown?.parking ?? []).map((row) => [row.market, row])
              );
              const kpbMap = new Map(
                (printBreakdown?.kpb ?? []).map((row) => [row.market, row])
              );
              const upahTurunMap = new Map(
                (printBreakdown?.upahTurun ?? []).map((row) => [row.market, row])
              );
              const marketWithAnyRows = MARKET_ORDER.filter(
                (market) =>
                  parkingMap.has(market) ||
                  kpbMap.has(market) ||
                  upahTurunMap.has(market)
              );

              if (isCharterMode) {
                return (
                  <>
                    <div className="grid grid-cols-3 items-center gap-3">
                      <label className="text-sm">Chop/Border</label>
                      <Input
                        readOnly
                        className="bg-muted/50 text-right font-mono"
                        value={form.chopBorderAmt}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right font-mono"
                        value={form.chopBorderActual}
                        onChange={(e) =>
                          setForm((prev) =>
                            prev
                              ? { ...prev, chopBorderActual: e.target.value }
                              : prev
                          )
                        }
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-3">
                      <label className="text-sm">Upah Turun</label>
                      <Input
                        readOnly
                        className="bg-muted/50 text-right font-mono"
                        value={form.upahTurunAmt}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right font-mono"
                        value={form.upahTurunActual}
                        onChange={(e) =>
                          setForm((prev) =>
                            prev
                              ? { ...prev, upahTurunActual: e.target.value }
                              : prev
                          )
                        }
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-3">
                      <label className="text-sm">Upah Naik Tong</label>
                      <Input
                        readOnly
                        className="bg-muted/50 text-right font-mono"
                        value={form.upahNaikTongAmt}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right font-mono"
                        value={form.upahNaikTongActual}
                        onChange={(e) =>
                          setForm((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  upahNaikTongActual: e.target.value,
                                }
                              : prev
                          )
                        }
                      />
                    </div>
                  </>
                );
              }

              return (
                <>
                  <div className="grid grid-cols-3 items-center gap-3">
                    <label className="text-sm">Chop/Border</label>
                    <Input
                      readOnly
                      className="bg-muted/50 text-right font-mono"
                      value={form.chopBorderAmt}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      className="text-right font-mono"
                      value={form.chopBorderActual}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev ? { ...prev, chopBorderActual: e.target.value } : prev
                        )
                      }
                    />
                  </div>
                  {marketWithAnyRows.map((market) => (
                    <div key={`market-block-${market}`} className="contents">
                      {parkingMap.get(market) && (
                        <div className="grid grid-cols-3 items-center gap-3">
                          <label className="text-sm">{`Parking ${market}`}</label>
                          <Input
                            readOnly
                            className="bg-muted/50 text-right font-mono"
                            value={String(parkingMap.get(market)!.suggested)}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            readOnly={!formEditable}
                            className="text-right font-mono"
                            value={getMarketActualFormValue(
                              marketActuals,
                              "parking",
                              market
                            )}
                            onChange={(e) =>
                              setMarketActuals((prev) =>
                                updateMarketActualCell(
                                  prev,
                                  "parking",
                                  market,
                                  e.target.value
                                )
                              )
                            }
                          />
                        </div>
                      )}
                      {(market === "KL" ||
                        (kpbMap.get(market) && !isKpbDisabledMarket(market))) && (
                        <div className="grid grid-cols-3 items-center gap-3">
                          <label className="text-sm">
                            {formatKpbFeeRowLabel(market, locale)}
                          </label>
                          <Input
                            readOnly
                            className="bg-muted/50 text-right font-mono"
                            value={String(kpbMap.get(market)?.suggested ?? "0")}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            readOnly={!formEditable}
                            className="text-right font-mono"
                            value={getMarketActualFormValue(
                              marketActuals,
                              "kpb",
                              market
                            )}
                            onChange={(e) =>
                              setMarketActuals((prev) =>
                                updateMarketActualCell(
                                  prev,
                                  "kpb",
                                  market,
                                  e.target.value
                                )
                              )
                            }
                          />
                        </div>
                      )}
                      {upahTurunMap.get(market) && (
                        <div className="grid grid-cols-3 items-center gap-3">
                          <label className="text-sm">{`Upah Turun ${market}`}</label>
                          <Input
                            readOnly
                            className="bg-muted/50 text-right font-mono"
                            value={String(upahTurunMap.get(market)!.suggested)}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            readOnly={!formEditable}
                            className="text-right font-mono"
                            value={getMarketActualFormValue(
                              marketActuals,
                              "unload",
                              market
                            )}
                            onChange={(e) =>
                              setMarketActuals((prev) =>
                                updateMarketActualCell(
                                  prev,
                                  "unload",
                                  market,
                                  e.target.value
                                )
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {marketWithAnyRows.length === 0 && (
                    <>
                      <div className="grid grid-cols-3 items-center gap-3">
                        <label className="text-sm">Parking</label>
                        <Input
                          readOnly
                          className="bg-muted/50 text-right font-mono"
                          value={form.parkingAmt}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          className="text-right font-mono"
                          value={form.parkingActual}
                          onChange={(e) =>
                            setForm((prev) =>
                              prev ? { ...prev, parkingActual: e.target.value } : prev
                            )
                          }
                        />
                      </div>
                      <div className="grid grid-cols-3 items-center gap-3">
                        <label className="text-sm">KPB</label>
                        <Input
                          readOnly
                          className="bg-muted/50 text-right font-mono"
                          value={form.kpbAmt}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          className="text-right font-mono"
                          value={form.kpbActual}
                          onChange={(e) =>
                            setForm((prev) =>
                              prev ? { ...prev, kpbActual: e.target.value } : prev
                            )
                          }
                        />
                      </div>
                      <div className="grid grid-cols-3 items-center gap-3">
                        <label className="text-sm">Upah Turun</label>
                        <Input
                          readOnly
                          className="bg-muted/50 text-right font-mono"
                          value={form.upahTurunAmt}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          className="text-right font-mono"
                          value={form.upahTurunActual}
                          onChange={(e) =>
                            setForm((prev) =>
                              prev ? { ...prev, upahTurunActual: e.target.value } : prev
                            )
                          }
                        />
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-3 items-center gap-3">
                    <label className="text-sm">Fish Check</label>
                    <Input
                      readOnly
                      className="bg-muted/50 text-right font-mono"
                      value={form.fishCheckAmt}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      className="text-right font-mono"
                      value={form.fishCheckActual}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev ? { ...prev, fishCheckActual: e.target.value } : prev
                        )
                      }
                    />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-3">
                    <label className="text-sm">{printBreakdown?.upahNaikTongLabel ?? "Upah Naik Tong"}</label>
                    <Input
                      readOnly
                      className="bg-muted/50 text-right font-mono"
                      value={String(
                        printBreakdown?.upahNaikTongSuggested ??
                          (parseOptionalNumber(form.upahNaikTongAmt) ?? 0)
                      )}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      className="text-right font-mono"
                      value={form.upahNaikTongActual}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev ? { ...prev, upahNaikTongActual: e.target.value } : prev
                        )
                      }
                    />
                  </div>
                </>
              );
            })()}

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
            </fieldset>

            {showDecisionPanel && voucherId && (
              <VoucherDecisionPanel
                onConfirm={handleConfirm}
                onFlagForReview={handleFlagForReview}
                busy={workflowBusyAny}
              />
            )}

            {showReviewPanel && form && voucherId && (
              <VoucherReviewPanel
                tripId={form.tripId}
                suggestedTotal={suggestedSubtotal}
                actualTotal={belanja}
                clerkNote={workflow.clerkNote}
                onApprove={handleApprove}
                onReject={handleReject}
                busy={workflowBusyAny}
              />
            )}

            {showReopenButton && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
                <p className="mb-2">{t("driverExpenses.form.reopenHint")}</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={workflowBusyAny}
                  className="border-amber-400 text-amber-950 hover:bg-amber-100"
                  onClick={() => void handleReopen()}
                >
                  {workflowBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("driverExpenses.form.reopen")
                  )}
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {showAdvanceOnlyButton && (
                <Button
                  type="button"
                  disabled={workflowBusyAny}
                  variant="outline"
                  className="border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100"
                  onClick={() => void submitAdvanceOnly()}
                  title={t("driverExpenses.form.saveAdvanceOnlyHint")}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("driverExpenses.form.saveAdvanceOnly")
                  )}
                </Button>
              )}
              {showFinalizeButtons && (
                <>
                  <Button
                    type="button"
                    disabled={workflowBusyAny}
                    className="bg-emerald-600 hover:bg-emerald-600/90"
                    onClick={() => void submitAndFinalize("confirmed")}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      t("driverExpenses.form.saveConfirm")
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={workflowBusyAny}
                    className="border-orange-300 text-orange-900 hover:bg-orange-50"
                    onClick={() => setShowFlagForm((v) => !v)}
                  >
                    {t("driverExpenses.form.saveFlag")}
                  </Button>
                </>
              )}
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

            {showAdvanceOnlyButton && (
              <p className="text-xs text-amber-900/80">
                {t("driverExpenses.form.saveAdvanceOnlyHint")}
              </p>
            )}

            {showFinalizeButtons && showFlagForm && (
              <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50/50 p-3">
                <label className="text-sm font-medium">
                  {t("driverExpenses.form.flagNote")}{" "}
                  <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={clerkNote}
                  onChange={(e) => setClerkNote(e.target.value)}
                  placeholder={t("driverExpenses.form.flagNotePlaceholder")}
                  rows={3}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={workflowBusyAny}
                  className="border-orange-300 text-orange-900 hover:bg-orange-50"
                  onClick={() =>
                    void submitAndFinalize("pending_review", clerkNote)
                  }
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("driverExpenses.form.submitFlag")
                  )}
                </Button>
              </div>
            )}
          </section>

          {mode === "edit" && voucherId && (
            <VoucherChangeLogTimeline logs={changeLogs} loading={logsLoading} />
          )}

        </>
      )}
      </div>
      {printData && (
        <DriverVoucherPrintArea
          voucher={printData}
          breakdown={printBreakdown}
        />
      )}
    </>
  );
}

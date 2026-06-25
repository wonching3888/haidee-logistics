"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMyr } from "@/lib/driver-expense/voucher-utils";
import { cn } from "@/lib/utils";

interface VoucherReviewPanelProps {
  tripId: string;
  suggestedTotal: number;
  actualTotal: number;
  clerkNote: string | null;
  onApprove: (note?: string) => Promise<void>;
  onReject: (note: string) => Promise<void>;
  busy: boolean;
}

export function VoucherReviewPanel({
  tripId,
  suggestedTotal,
  actualTotal,
  clerkNote,
  onApprove,
  onReject,
  busy,
}: VoucherReviewPanelProps) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const diff = actualTotal - suggestedTotal;

  async function handleApprove() {
    setError(null);
    try {
      await onApprove(reviewNote.trim() || undefined);
      setMode("idle");
      setReviewNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败 / Action failed");
    }
  }

  async function handleReject() {
    if (!reviewNote.trim()) {
      setError("请填写打回原因 / Rejection reason required");
      return;
    }
    setError(null);
    try {
      await onReject(reviewNote.trim());
      setMode("idle");
      setReviewNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败 / Action failed");
    }
  }

  return (
    <section className="no-print space-y-4 rounded-xl border border-orange-200 bg-orange-50/40 p-4">
      <h3 className="font-semibold text-haidee-text">ADMIN 审核 / Review</h3>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-haidee-border bg-white p-3">
          <p className="text-xs text-haidee-muted">系统建议合计</p>
          <p className="font-mono text-lg font-semibold">
            {formatMyr(suggestedTotal)}
          </p>
        </div>
        <div className="rounded-lg border border-haidee-border bg-white p-3">
          <p className="text-xs text-haidee-muted">实际合计 (Belanja)</p>
          <p className="font-mono text-lg font-semibold">
            {formatMyr(actualTotal)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg border p-3",
            diff !== 0
              ? "border-orange-300 bg-orange-100/60"
              : "border-haidee-border bg-white"
          )}
        >
          <p className="text-xs text-haidee-muted">差额 (实际 − 建议)</p>
          <p
            className={cn(
              "font-mono text-lg font-semibold",
              diff !== 0 && "text-orange-800"
            )}
          >
            {diff > 0 ? "+" : ""}
            {formatMyr(diff)}
          </p>
        </div>
      </div>

      {clerkNote && (
        <div className="rounded-lg border border-haidee-border bg-white p-3 text-sm">
          <p className="mb-1 font-medium text-haidee-muted">书记备注</p>
          <p className="whitespace-pre-wrap">{clerkNote}</p>
        </div>
      )}

      <Link
        href={`/dispatch/${tripId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-haidee-blue hover:underline"
      >
        查看趟次 / View dispatch
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy}
          className="bg-emerald-600 hover:bg-emerald-600/90"
          onClick={() => {
            setMode("approve");
            setError(null);
          }}
        >
          通过 ✓
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className="border-red-300 text-red-800 hover:bg-red-50"
          onClick={() => {
            setMode("reject");
            setError(null);
          }}
        >
          打回 ✗
        </Button>
      </div>

      {mode === "approve" && (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-white p-3">
          <label className="text-sm font-medium">
            审核备注（可选）/ Review note (optional)
          </label>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={2}
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleApprove()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认通过"}
          </Button>
        </div>
      )}

      {mode === "reject" && (
        <div className="space-y-2 rounded-lg border border-red-200 bg-white p-3">
          <label className="text-sm font-medium">
            打回原因 <span className="text-red-600">*</span>
          </label>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={3}
            placeholder="说明打回原因…"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="border-red-300 text-red-800 hover:bg-red-50"
            onClick={() => void handleReject()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认打回"}
          </Button>
        </div>
      )}
    </section>
  );
}

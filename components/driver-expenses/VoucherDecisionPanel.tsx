"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VoucherDecisionPanelProps {
  onConfirm: () => Promise<void>;
  onFlagForReview: (note: string) => Promise<void>;
  busy: boolean;
}

export function VoucherDecisionPanel({
  onConfirm,
  onFlagForReview,
  busy,
}: VoucherDecisionPanelProps) {
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [clerkNote, setClerkNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败 / Action failed");
    }
  }

  async function handleFlag() {
    if (!clerkNote.trim()) {
      setError("请填写标记需审核的原因 / Clerk note required");
      return;
    }
    setError(null);
    try {
      await onFlagForReview(clerkNote.trim());
      setShowFlagForm(false);
      setClerkNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败 / Action failed");
    }
  }

  return (
    <section className="no-print space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <h3 className="font-semibold text-haidee-text">
        书记确认 / Clerk decision
      </h3>
      <p className="text-sm text-haidee-muted">
        核对实际金额后确认无误，或标记需 ADMIN 审核。
      </p>

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
          onClick={() => void handleConfirm()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "确认无误 ✓"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setShowFlagForm((v) => !v)}
        >
          标记需审核 ⚠
        </Button>
      </div>

      {showFlagForm && (
        <div className="space-y-2 rounded-lg border border-orange-200 bg-white p-3">
          <label className="text-sm font-medium">
            书记备注 / Clerk note <span className="text-red-600">*</span>
          </label>
          <textarea
            value={clerkNote}
            onChange={(e) => setClerkNote(e.target.value)}
            placeholder="说明为何需要审核…"
            rows={3}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="border-orange-300 text-orange-900 hover:bg-orange-50"
            onClick={() => void handleFlag()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "提交标记 / Submit flag"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}

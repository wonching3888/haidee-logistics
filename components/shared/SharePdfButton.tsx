"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  shareElementAsPdf,
  type PdfSharePayload,
  type PdfShareResult,
} from "@/lib/print-pdf-share";

interface SharePdfButtonProps {
  getContentElement: () => HTMLElement | null;
  payload: PdfSharePayload;
  /** Compact icon+label for toolbars; default false */
  compact?: boolean;
}

export function SharePdfButton({
  getContentElement,
  payload,
  compact = false,
}: SharePdfButtonProps) {
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<PdfShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    const element = getContentElement();
    if (!element) {
      setError("找不到分享内容区域");
      return;
    }

    setBusy(true);
    setError(null);
    setLastResult(null);

    try {
      const result = await shareElementAsPdf(element, payload);
      setLastResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成或分享 PDF 失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "inline-flex flex-col items-end gap-1.5" : "space-y-2"}>
      <Button
        type="button"
        variant={compact ? "outline" : "default"}
        size={compact ? "sm" : "default"}
        onClick={() => void handleShare()}
        disabled={busy}
        className={
          compact
            ? "gap-1.5 border-haidee-border text-haidee-text hover:bg-haidee-surface"
            : "gap-1 bg-haidee-blue text-white hover:bg-haidee-blue/90"
        }
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        {busy ? "生成 PDF…" : "分享 PDF"}
      </Button>

      {lastResult ? (
        <p
          className={`max-w-xs rounded-md px-2.5 py-1.5 text-xs ${
            lastResult.method === "cancelled" || lastResult.method === "unsupported"
              ? "bg-amber-50 text-amber-900"
              : "bg-emerald-50 text-emerald-900"
          }`}
        >
          {lastResult.message}
        </p>
      ) : null}

      {error ? (
        <p className="max-w-xs rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-haidee-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

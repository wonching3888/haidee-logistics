"use client";

import { useEffect, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARKET_DO_LANDSCAPE_COLUMN_THRESHOLD } from "@/lib/market-do-route-groups";
import {
  probeShareCapability,
  shareElementAsPdf,
  type PdfSharePayload,
  type PdfShareResult,
  type ShareCapabilityProbe,
} from "@/lib/print-pdf-share";

interface PrintPdfSharePrototypeProps {
  getContentElement: () => HTMLElement | null;
  payload: PdfSharePayload;
  /** When set, capture each section separately and merge into one PDF. */
  sectionSelector?: string;
  activeColumnCount?: number;
}

export function PrintPdfSharePrototype({
  getContentElement,
  payload,
  sectionSelector,
  activeColumnCount,
}: PrintPdfSharePrototypeProps) {
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<ShareCapabilityProbe | null>(null);
  const [lastResult, setLastResult] = useState<PdfShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProbe(probeShareCapability());
  }, []);

  async function handleShare() {
    const element = getContentElement();
    if (!element) {
      setError("找不到打印内容区域");
      return;
    }

    setBusy(true);
    setError(null);
    setLastResult(null);

    try {
      const result = await shareElementAsPdf(element, payload, {
        sectionSelector,
        activeColumnCount,
        autoLandscape: true,
        minDepotCountForLandscape: MARKET_DO_LANDSCAPE_COLUMN_THRESHOLD,
      });
      setLastResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成或分享 PDF 失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={() => void handleShare()}
        disabled={busy}
        className="gap-1 bg-haidee-blue text-white hover:bg-haidee-blue/90"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        {busy ? "生成 PDF…" : "分享 PDF"}
      </Button>

      {probe ? (
        <p className="max-w-xl text-xs text-haidee-muted">
          原型检测：Web Share{" "}
          {probe.hasNavigatorShare ? "✓" : "✗"} · 可分享文件{" "}
          {probe.canShareFiles ? "✓" : "✗"}
          {probe.notes.length > 0 ? ` · ${probe.notes.join("；")}` : null}
        </p>
      ) : null}

      {lastResult ? (
        <p
          className={`max-w-xl rounded-md px-3 py-2 text-sm ${
            lastResult.method === "cancelled"
              ? "bg-amber-50 text-amber-900"
              : lastResult.method === "unsupported"
                ? "bg-amber-50 text-amber-900"
                : "bg-emerald-50 text-emerald-900"
          }`}
        >
          {lastResult.message}
        </p>
      ) : null}

      {error ? (
        <p className="max-w-xl rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

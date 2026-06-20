"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import type { DailyDispatchSummaryData } from "@/app/actions/dashboard";
import { DailyDispatchSummary } from "@/components/dashboard/DailyDispatchSummary";

const SharePdfButton = dynamic(
  () =>
    import("@/components/shared/SharePdfButton").then((m) => ({
      default: m.SharePdfButton,
    })),
  { ssr: false }
);

interface DailyDispatchSummarySectionProps {
  data: DailyDispatchSummaryData;
}

export function DailyDispatchSummarySection({
  data,
}: DailyDispatchSummarySectionProps) {
  const captureRef = useRef<HTMLDivElement>(null);

  const sharePayload = {
    fileName: `WTL-Daily-Record-${data.date}.pdf`,
    title: `WTL Daily Record ${data.date}`,
    text: `WTL EXPRESS SDN BHD — Daily Record ${data.date}`,
  };

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-haidee-text">
          每日派车总结 Daily Summary
        </h3>
        <SharePdfButton
          compact
          getContentElement={() => captureRef.current}
          payload={sharePayload}
        />
      </div>
      <div ref={captureRef} className="min-w-0">
        <DailyDispatchSummary data={data} />
      </div>
    </div>
  );
}

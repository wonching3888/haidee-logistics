"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SuccessBanner } from "@/components/shared/SuccessBanner";

/** Shows success flash from ?updated=TE-... after edit redirect. */
export function CrateExportUpdatedBanner() {
  const searchParams = useSearchParams();
  const updated = searchParams.get("updated")?.trim();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (updated) {
      setMessage(`归还单 ${updated} 已更新 ✓`);
    }
  }, [updated]);

  return (
    <SuccessBanner message={message} onDismiss={() => setMessage(null)} />
  );
}

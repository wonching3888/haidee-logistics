"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SuccessBanner } from "@/components/shared/SuccessBanner";
import { useT } from "@/components/shared/locale-context";

/** Shows success flash from ?updated=TE-... after edit redirect. */
export function CrateExportUpdatedBanner() {
  const searchParams = useSearchParams();
  const { t } = useT();
  const updated = searchParams.get("updated")?.trim();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (updated) {
      setMessage(t("crateExport.updateSuccess", { exportNo: updated }));
    }
  }, [updated, t]);

  return (
    <SuccessBanner message={message} onDismiss={() => setMessage(null)} />
  );
}

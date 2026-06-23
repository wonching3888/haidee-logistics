"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SuccessBanner } from "@/components/shared/SuccessBanner";

/** Shows success flash from ?deleted=... after delete redirect. */
export function CharterDeletedBanner() {
  const searchParams = useSearchParams();
  const deleted = searchParams.get("deleted")?.trim();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (deleted) {
      setMessage(`包车单 ${deleted} 已删除 Charter trip deleted.`);
    }
  }, [deleted]);

  return (
    <SuccessBanner message={message} onDismiss={() => setMessage(null)} />
  );
}

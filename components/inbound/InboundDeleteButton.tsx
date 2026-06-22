"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteInboundSession } from "@/app/actions/inbound";
import { useT } from "@/components/shared/locale-context";
import { Button } from "@/components/ui/button";
import { getNextRedirectUrl } from "@/lib/next-redirect";

interface InboundDeleteButtonProps {
  sessionId: string;
  variant?: "button" | "icon";
}

export function InboundDeleteButton({
  sessionId,
  variant = "button",
}: InboundDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { t, tLocal } = useT();

  function handleDelete() {
    if (!confirm(tLocal("inbound.deleteSessionConfirm"))) return;

    startTransition(async () => {
      try {
        await deleteInboundSession(sessionId);
        router.replace("/inbound");
      } catch (e) {
        const redirectUrl = getNextRedirectUrl(e);
        if (redirectUrl) {
          router.replace(redirectUrl);
          return;
        }
        alert(e instanceof Error ? e.message : t("error.deleteFailed"));
      }
    });
  }

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        className="text-haidee-red hover:text-haidee-red"
        aria-label={tLocal("inbound.deleteSession")}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="destructive"
      onClick={handleDelete}
      disabled={isPending}
      className="min-h-[44px] min-w-[100px] bg-haidee-red text-white hover:bg-haidee-red/90"
    >
      {isPending ? t("common.deleting") : t("common.delete")}
    </Button>
  );
}

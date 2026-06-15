"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteInboundSession } from "@/app/actions/inbound";
import { Button } from "@/components/ui/button";

const CONFIRM_MESSAGE =
  "确定要删除这张进货单吗？此操作无法撤销。\nAre you sure you want to delete this inbound session? This cannot be undone.";

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: string }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

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

  function handleDelete() {
    if (!confirm(CONFIRM_MESSAGE)) return;

    startTransition(async () => {
      try {
        await deleteInboundSession(sessionId);
        router.push("/inbound");
      } catch (e) {
        if (isNextRedirectError(e)) throw e;
        alert(e instanceof Error ? e.message : "删除失败 Delete failed");
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
        aria-label="删除进货单 Delete inbound session"
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
      {isPending ? "删除中…" : "删除 Delete"}
    </Button>
  );
}

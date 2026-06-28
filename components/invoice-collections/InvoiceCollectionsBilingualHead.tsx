"use client";

import { TableHead } from "@/components/ui/table";
import { useT } from "@/components/shared/locale-context";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export function InvoiceCollectionsBilingualHead({
  messageKey,
  className,
  align = "left",
}: {
  messageKey: MessageKey;
  className?: string;
  align?: "left" | "right";
}) {
  const { parts } = useT();
  const { local, en } = parts(messageKey);

  return (
    <TableHead
      className={cn(
        "whitespace-normal align-top py-1.5 leading-tight",
        align === "right" && "text-right",
        className
      )}
    >
      <div>{local}</div>
      {en ? (
        <div className="text-[10px] font-normal text-haidee-muted">{en}</div>
      ) : null}
    </TableHead>
  );
}

export function InvoiceCollectionsBilingualLabel({
  messageKey,
  className,
  titleClassName,
  subtitleClassName,
}: {
  messageKey: MessageKey;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}) {
  const { parts } = useT();
  const { local, en } = parts(messageKey);

  return (
    <div className={className}>
      <div className={cn("font-medium text-haidee-text", titleClassName)}>
        {local}
      </div>
      {en ? (
        <div
          className={cn(
            "text-[10px] text-haidee-muted",
            subtitleClassName
          )}
        >
          {en}
        </div>
      ) : null}
    </div>
  );
}

import { getMarketColor } from "@/lib/markets";
import { cn } from "@/lib/utils";

interface DispatchMarketLabelProps {
  code: string;
  selected?: boolean;
  className?: string;
}

export function DispatchMarketLabel({
  code,
  selected = false,
  className,
}: DispatchMarketLabelProps) {
  const colors = getMarketColor(code);

  return (
    <span
      className={cn(
        "inline-flex min-h-[28px] min-w-[36px] items-center justify-center rounded px-2 py-0.5 font-mono text-xs font-semibold",
        selected && "ring-2 ring-haidee-navy ring-offset-1",
        className
      )}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {code}
    </span>
  );
}

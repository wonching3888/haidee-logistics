import { getMarketColor } from "@/lib/markets";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import { cn } from "@/lib/utils";

interface MarketBadgeProps {
  code: string;
  className?: string;
}

export function MarketBadge({ code, className }: MarketBadgeProps) {
  const colors = getMarketColor(code);

  return (
    <span
      className={cn(
        "inline-flex min-h-[28px] min-w-[36px] items-center justify-center rounded px-2 py-0.5 font-mono text-xs font-semibold",
        className
      )}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
      title={getMarketDisplayName(code)}
    >
      {code}
    </span>
  );
}

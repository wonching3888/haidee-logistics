import { getMarketColor } from "@/lib/markets";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import { cn } from "@/lib/utils";

interface DispatchMarketLabelProps {
  code: string;
  selected?: boolean;
  className?: string;
  showDisplayName?: boolean;
}

export function DispatchMarketLabel({
  code,
  selected = false,
  className,
  showDisplayName = false,
}: DispatchMarketLabelProps) {
  const colors = getMarketColor(code);

  return (
    <span
      className={cn(
        "inline-flex min-w-[44px] items-center justify-center rounded px-2.5 py-1.5 font-mono text-sm font-semibold",
        showDisplayName && "min-w-[72px] flex-col leading-tight py-1",
        selected && "ring-2 ring-haidee-navy ring-offset-1",
        className
      )}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
      title={getMarketDisplayName(code)}
    >
      {showDisplayName ? (
        <>
          <span>{code}</span>
          <span className="text-[10px] font-bold">{getMarketDisplayName(code)}</span>
        </>
      ) : (
        code
      )}
    </span>
  );
}

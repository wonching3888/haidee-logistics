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
  return (
    <span
      className={cn(
        selected
          ? "rounded border-2 border-haidee-navy bg-white px-2 py-0.5 text-xs font-medium text-haidee-navy"
          : "rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700",
        className
      )}
    >
      {code}
    </span>
  );
}

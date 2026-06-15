import { cn } from "@/lib/utils";
import { truncateNameForMobile } from "@/lib/consignor-label";

interface MobileTruncatedNameProps {
  text: string;
  className?: string;
}

/** Mobile-only name truncation with full text in title for tap/hover. */
export function MobileTruncatedName({ text, className }: MobileTruncatedNameProps) {
  const label = text ?? "";
  const shouldTruncate = label.length > 15;
  const mobileDisplay = truncateNameForMobile(label);

  return (
    <>
      <span
        className={cn("md:hidden", className)}
        title={shouldTruncate ? label : undefined}
      >
        {mobileDisplay}
      </span>
      <span className={cn("hidden md:inline", className)}>{label}</span>
    </>
  );
}

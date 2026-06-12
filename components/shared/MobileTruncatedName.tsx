import { cn } from "@/lib/utils";
import { truncateNameForMobile } from "@/lib/consignor-label";

interface MobileTruncatedNameProps {
  text: string;
  className?: string;
}

/** Mobile-only name truncation with full text in title for tap/hover. */
export function MobileTruncatedName({ text, className }: MobileTruncatedNameProps) {
  const shouldTruncate = text.length > 15;
  const mobileDisplay = truncateNameForMobile(text);

  return (
    <>
      <span
        className={cn("md:hidden", className)}
        title={shouldTruncate ? text : undefined}
      >
        {mobileDisplay}
      </span>
      <span className={cn("hidden md:inline", className)}>{text}</span>
    </>
  );
}

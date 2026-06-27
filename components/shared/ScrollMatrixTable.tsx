"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  getMatrixTableFillParentScrollStyle,
  getMatrixTableScrollStyle,
} from "@/lib/table-scroll";
import { cn } from "@/lib/utils";

interface ScrollMatrixTableProps {
  children: ReactNode;
  heightOffset?: number;
  /** When true, height follows parent flex chain instead of calc(100vh - offset). */
  fillParent?: boolean;
  /**
   * Below md: drop calc(100vh) height so AppShell main scrolls vertically on phones.
   * Desktop (md+) keeps viewport-tied height when heightOffset is set.
   */
  naturalHeightOnMobile?: boolean;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
}

export function ScrollMatrixTable({
  children,
  heightOffset = 260,
  fillParent = false,
  naturalHeightOnMobile = true,
  className,
  innerClassName,
  style,
}: ScrollMatrixTableProps) {
  const scrollStyle = fillParent
    ? getMatrixTableFillParentScrollStyle()
    : getMatrixTableScrollStyle(heightOffset);

  const useNaturalMobile = naturalHeightOnMobile && !fillParent;

  return (
    <div
      className={cn(
        "scroll-matrix-root flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-haidee-border bg-white",
        fillParent && "h-full",
        useNaturalMobile && "scroll-matrix-natural-mobile",
        className
      )}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className={cn("scroll-matrix-table", innerClassName)}
          style={{ ...scrollStyle, ...style }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

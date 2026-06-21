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
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
}

export function ScrollMatrixTable({
  children,
  heightOffset = 260,
  fillParent = false,
  className,
  innerClassName,
  style,
}: ScrollMatrixTableProps) {
  const scrollStyle = fillParent
    ? getMatrixTableFillParentScrollStyle()
    : getMatrixTableScrollStyle(heightOffset);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-haidee-border bg-white",
        fillParent && "h-full",
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

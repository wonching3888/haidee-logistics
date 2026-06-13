"use client";

import type { CSSProperties, ReactNode } from "react";
import { getMatrixTableScrollStyle } from "@/lib/table-scroll";
import { cn } from "@/lib/utils";

interface ScrollMatrixTableProps {
  children: ReactNode;
  heightOffset?: number;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
}

export function ScrollMatrixTable({
  children,
  heightOffset = 260,
  className,
  innerClassName,
  style,
}: ScrollMatrixTableProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-haidee-border bg-white",
        className
      )}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className={cn("scroll-matrix-table", innerClassName)}
          style={{ ...getMatrixTableScrollStyle(heightOffset), ...style }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { Table } from "@/components/ui/table";
import {
  stickyFirstColTableClass,
  stickyHeaderRowTableClass,
} from "@/lib/table-scroll";
import { cn } from "@/lib/utils";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";

export interface WideTableScrollAreaProps {
  children: ReactNode;
  /** Viewport offset for desktop inner scroll height (calc(100vh - offset)). */
  heightOffset?: number;
  className?: string;
  tableClassName?: string;
  /** Pin first column while horizontally scrolling (default true). */
  pinFirstColumn?: boolean;
  fillParent?: boolean;
  /**
   * Below md: natural table height + page vertical scroll (default true).
   * Disabled automatically when fillParent is true.
   */
  naturalHeightOnMobile?: boolean;
}

/**
 * Standard wide-table scroll container:
 * - Desktop: horizontal + vertical scroll in viewport-tied area; sticky header row.
 * - Mobile: horizontal scroll only in wrapper; vertical scroll on AppShell main.
 *
 * Reference pattern: DocumentsClient, HistoryView (ScrollMatrixTable + sticky thead).
 */
export function WideTableScrollArea({
  children,
  heightOffset = 280,
  className,
  tableClassName,
  pinFirstColumn = true,
  fillParent = false,
  naturalHeightOnMobile = true,
}: WideTableScrollAreaProps) {
  const stickyTableClass = pinFirstColumn
    ? stickyFirstColTableClass
    : stickyHeaderRowTableClass;

  return (
    <ScrollMatrixTable
      heightOffset={heightOffset}
      fillParent={fillParent}
      naturalHeightOnMobile={naturalHeightOnMobile}
      className={className}
    >
      <Table noScrollContainer className={cn(stickyTableClass, tableClassName)}>
        {children}
      </Table>
    </ScrollMatrixTable>
  );
}

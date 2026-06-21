import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const matrixTableScrollBase: CSSProperties = {
  maxHeight: "100%",
  minHeight: 0,
  overflowX: "auto",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
};

export function getMatrixTableScrollStyle(heightOffset = 260): CSSProperties {
  return {
    ...matrixTableScrollBase,
    height: `calc(100vh - ${heightOffset}px)`,
  };
}

/** Fill parent flex chain (opt-in via ScrollMatrixTable fillParent). */
export function getMatrixTableFillParentScrollStyle(): CSSProperties {
  return {
    ...matrixTableScrollBase,
    height: "100%",
  };
}

export const STICKY_HEAD_TOP =
  "sticky top-0 z-20 bg-haidee-surface shadow-[0_1px_0_0] shadow-haidee-border";

export const STICKY_HEAD_FIRST =
  "sticky left-0 top-0 z-30 bg-haidee-surface shadow-[1px_0_0_0] shadow-haidee-border";

export const STICKY_BODY_FIRST =
  "sticky left-0 z-10 bg-white shadow-[1px_0_0_0] shadow-haidee-border";

export const STICKY_BODY_FIRST_SURFACE =
  "sticky left-0 z-10 bg-haidee-surface shadow-[1px_0_0_0] shadow-haidee-border";

export const STICKY_HEAD_ACTIONS =
  "sticky right-0 top-0 z-30 bg-haidee-surface shadow-[-1px_0_0_0] shadow-haidee-border";

export const STICKY_BODY_ACTIONS =
  "sticky right-0 z-10 bg-white shadow-[-1px_0_0_0] shadow-haidee-border";

export const FIRST_COL_WIDTH = "min-w-[160px] max-w-[160px] w-[160px]";

/** Inbound list: three consecutive sticky left columns (date + batch + consignor). */
export const INBOUND_DATE_COL = "w-[92px] min-w-[92px] max-w-[92px]";
export const INBOUND_BATCH_COL = "w-[100px] min-w-[100px] max-w-[100px]";
export const INBOUND_CONSIGNOR_COL = "w-[150px] min-w-[150px] max-w-[150px]";

/** Cumulative left offsets: 0 → 92 → 192 (92 + 100). */
export const INBOUND_BATCH_STICKY_LEFT = "left-[92px]";
export const INBOUND_CONSIGNOR_STICKY_LEFT = "left-[192px]";

export const INBOUND_AREA_COL = "w-[72px] min-w-[72px] max-w-[72px]";
export const INBOUND_TH_PLATE_COL = "w-[88px] min-w-[88px] max-w-[88px]";
export const INBOUND_ACTIONS_COL = "w-[132px] min-w-[132px] max-w-[132px]";

export const STICKY_HEAD_BATCH = cn(
  "sticky top-0 z-30 bg-haidee-surface shadow-[1px_0_0_0] shadow-haidee-border",
  INBOUND_BATCH_STICKY_LEFT
);

export const STICKY_BODY_BATCH = cn(
  "sticky z-[15] bg-white shadow-[1px_0_0_0] shadow-haidee-border",
  INBOUND_BATCH_STICKY_LEFT
);

export const STICKY_HEAD_CONSIGNOR = cn(
  "sticky top-0 z-30 bg-haidee-surface shadow-[1px_0_0_0] shadow-haidee-border",
  INBOUND_CONSIGNOR_STICKY_LEFT
);

export const STICKY_BODY_CONSIGNOR = cn(
  "sticky z-20 bg-white shadow-[1px_0_0_0] shadow-haidee-border",
  INBOUND_CONSIGNOR_STICKY_LEFT
);

export const stickyRowHoverBodyClass =
  "bg-white group-hover:bg-haidee-surface/50";

/** Apply sticky first column to shadcn Table via descendant selectors */
export const stickyFirstColTableClass = cn(
  "[&_thead_th:first-child]:sticky [&_thead_th:first-child]:left-0 [&_thead_th:first-child]:top-0 [&_thead_th:first-child]:z-30 [&_thead_th:first-child]:bg-haidee-surface",
  "[&_tbody_td:first-child]:sticky [&_tbody_td:first-child]:left-0 [&_tbody_td:first-child]:z-10 [&_tbody_td:first-child]:bg-white",
  "[&_thead_th:not(:first-child)]:sticky [&_thead_th:not(:first-child)]:top-0 [&_thead_th:not(:first-child)]:z-20 [&_thead_th:not(:first-child)]:bg-haidee-surface"
);

/** Sticky expand button + label columns (customer crate stock) */
export const stickyFirstTwoColTableClass = cn(
  "[&_thead_th:nth-child(1)]:sticky [&_thead_th:nth-child(1)]:left-0 [&_thead_th:nth-child(1)]:top-0 [&_thead_th:nth-child(1)]:z-30 [&_thead_th:nth-child(1)]:w-10 [&_thead_th:nth-child(1)]:min-w-10 [&_thead_th:nth-child(1)]:bg-haidee-surface",
  "[&_thead_th:nth-child(2)]:sticky [&_thead_th:nth-child(2)]:left-10 [&_thead_th:nth-child(2)]:top-0 [&_thead_th:nth-child(2)]:z-30 [&_thead_th:nth-child(2)]:min-w-[160px] [&_thead_th:nth-child(2)]:bg-haidee-surface",
  "[&_tbody_td:nth-child(1)]:sticky [&_tbody_td:nth-child(1)]:left-0 [&_tbody_td:nth-child(1)]:z-10 [&_tbody_td:nth-child(1)]:bg-white",
  "[&_tbody_td:nth-child(2)]:sticky [&_tbody_td:nth-child(2)]:left-10 [&_tbody_td:nth-child(2)]:z-10 [&_tbody_td:nth-child(2)]:min-w-[160px] [&_tbody_td:nth-child(2)]:bg-white",
  "[&_thead_th:nth-child(n+3)]:sticky [&_thead_th:nth-child(n+3)]:top-0 [&_thead_th:nth-child(n+3)]:z-20 [&_thead_th:nth-child(n+3)]:bg-haidee-surface"
);

export const stickyActionsColTableClass = cn(
  "[&_thead_th:last-child]:sticky [&_thead_th:last-child]:right-0 [&_thead_th:last-child]:top-0 [&_thead_th:last-child]:z-30 [&_thead_th:last-child]:bg-haidee-surface",
  "[&_tbody_td:last-child]:sticky [&_tbody_td:last-child]:right-0 [&_tbody_td:last-child]:z-10 [&_tbody_td:last-child]:bg-white"
);

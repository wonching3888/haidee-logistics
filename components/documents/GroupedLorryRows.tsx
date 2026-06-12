import { Fragment, type ReactNode } from "react";
import type { AreaTruckRow, ReportLorryGroup } from "@/lib/market-do-grouping";
import { ReportSpacerRow } from "@/components/documents/GroupedAreaTruckRows";

interface GroupedLorryRowsProps<T extends AreaTruckRow> {
  lorryGroups: ReportLorryGroup<T>[];
  colSpan: number;
  rowKey: (row: T) => string;
  renderRow: (row: T) => ReactNode;
  renderLorrySubtotal?: (group: ReportLorryGroup<T>) => ReactNode;
}

/** tbody rows: lorry header → data rows → lorry subtotal → gap before next lorry. */
export function GroupedLorryRows<T extends AreaTruckRow>({
  lorryGroups,
  colSpan,
  rowKey,
  renderRow,
  renderLorrySubtotal,
}: GroupedLorryRowsProps<T>) {
  return (
    <>
      {lorryGroups.map((group, groupIndex) => (
        <Fragment key={group.lorryNo}>
          <tr className="market-do-area-header">
            <td colSpan={colSpan} className="text-left">
              {group.lorryNo}
            </td>
          </tr>
          {group.rows.map((row) => (
            <Fragment key={rowKey(row)}>{renderRow(row)}</Fragment>
          ))}
          {renderLorrySubtotal?.(group)}
          {groupIndex < lorryGroups.length - 1 && (
            <ReportSpacerRow colSpan={colSpan} />
          )}
        </Fragment>
      ))}
    </>
  );
}

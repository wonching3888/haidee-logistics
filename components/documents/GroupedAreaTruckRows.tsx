import { Fragment, type ReactNode } from "react";
import type { AreaTruckRow, ReportAreaGroup } from "@/lib/market-do-grouping";

export function ReportSpacerRow({ colSpan }: { colSpan: number }) {
  return (
    <tr className="market-do-spacer" aria-hidden="true">
      <td colSpan={colSpan}>&nbsp;</td>
    </tr>
  );
}

interface GroupedAreaTruckRowsProps<T extends AreaTruckRow> {
  areaGroups: ReportAreaGroup<T>[];
  colSpan: number;
  rowKey: (row: T) => string;
  renderRow: (row: T) => ReactNode;
}

/** Shared tbody rows: area header → truck groups (spacer between trucks) → area gap (2 rows). */
export function GroupedAreaTruckRows<T extends AreaTruckRow>({
  areaGroups,
  colSpan,
  rowKey,
  renderRow,
}: GroupedAreaTruckRowsProps<T>) {
  return (
    <>
      {areaGroups.map((areaGroup, areaIndex) => (
        <Fragment key={areaGroup.areaName}>
          <tr className="market-do-area-header">
            <td colSpan={colSpan} className="text-left">
              {areaGroup.areaName}
            </td>
          </tr>
          {areaGroup.trucks.map((truck, truckIndex) => (
            <Fragment key={`${areaGroup.areaName}:${truck.lorryNo}`}>
              {truckIndex > 0 && <ReportSpacerRow colSpan={colSpan} />}
              {truck.rows.map((row) => (
                <Fragment key={rowKey(row)}>{renderRow(row)}</Fragment>
              ))}
            </Fragment>
          ))}
          {areaIndex < areaGroups.length - 1 && (
            <>
              <ReportSpacerRow
                colSpan={colSpan}
                key={`${areaGroup.areaName}-gap-1`}
              />
              <ReportSpacerRow
                colSpan={colSpan}
                key={`${areaGroup.areaName}-gap-2`}
              />
            </>
          )}
        </Fragment>
      ))}
    </>
  );
}

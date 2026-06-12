import { Fragment, type ReactNode } from "react";
import type {
  AreaTruckRow,
  ReportAreaGroup,
  ReportTruckGroup,
} from "@/lib/market-do-grouping";

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
  renderTruckSubtotal?: (
    truck: ReportTruckGroup<T>,
    areaGroup: ReportAreaGroup<T>
  ) => ReactNode;
  renderAreaSubtotal?: (areaGroup: ReportAreaGroup<T>) => ReactNode;
}

export function flattenAreaGroupRows<T>(areaGroup: ReportAreaGroup<T>): T[] {
  return areaGroup.trucks.flatMap((truck) => truck.rows);
}

/** Shared tbody rows: area header → truck groups (spacer between trucks) → area gap (2 rows). */
export function GroupedAreaTruckRows<T extends AreaTruckRow>({
  areaGroups,
  colSpan,
  rowKey,
  renderRow,
  renderTruckSubtotal,
  renderAreaSubtotal,
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
              {renderTruckSubtotal?.(truck, areaGroup)}
            </Fragment>
          ))}
          {renderAreaSubtotal?.(areaGroup)}
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

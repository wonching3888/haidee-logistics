import Link from "next/link";
import { formatDisplay } from "@/lib/date-utils";
import type { CrateExportListRow } from "@/lib/crate-export-list";

interface CrateExportListTableProps {
  rows: CrateExportListRow[];
  /** yyyy-MM-dd — used in reprint returnTo link */
  listDate: string;
}

function buildReprintHref(exportNo: string, listDate: string): string {
  const returnTo = `/crate/export?date=${encodeURIComponent(listDate)}`;
  return `/crate/export/print?exportNo=${encodeURIComponent(exportNo)}&returnTo=${encodeURIComponent(returnTo)}`;
}

export function CrateExportListTable({ rows, listDate }: CrateExportListTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-haidee-border bg-white p-10 text-center text-sm text-haidee-muted">
        该日暂无归还单 No crate exports for this date
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-haidee-border bg-white">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium">日期 Date</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium">TE 号</th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
              寄货人 Consignor
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
              车牌 Plate
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-medium">
              合计 Total (ลัง)
            </th>
            <th className="whitespace-nowrap px-4 py-3 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.exportNo}
              className="border-b border-haidee-border/60 hover:bg-haidee-surface/40"
            >
              <td className="whitespace-nowrap px-4 py-3">
                {formatDisplay(row.date)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-haidee-text">
                {row.exportNo}
              </td>
              <td className="max-w-[200px] truncate px-4 py-3" title={row.shipperName}>
                {row.shipperName}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono">
                {row.thVehiclePlate}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold">
                {row.totalActual}
                {row.totalShortage > 0 ? (
                  <span className="ml-2 text-xs font-normal text-haidee-red">
                    欠 {row.totalShortage}
                  </span>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <Link
                  href={buildReprintHref(row.exportNo, listDate)}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-haidee-blue px-3 text-sm text-haidee-blue transition-colors hover:bg-haidee-blue/10"
                >
                  重打 Reprint
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

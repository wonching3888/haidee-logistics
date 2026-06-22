"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { voidCrateExport } from "@/app/actions/crateExport";
import { SuccessBanner } from "@/components/shared/SuccessBanner";
import { useCanWrite } from "@/components/shared/can-write-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const router = useRouter();
  const userCanWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  const [voidTarget, setVoidTarget] = useState<CrateExportListRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-haidee-border bg-white p-10 text-center text-sm text-haidee-muted">
        该日暂无归还单 No crate exports for this date
      </div>
    );
  }

  function handleVoidConfirm() {
    if (!voidTarget) return;
    setError(null);
    startTransition(async () => {
      try {
        await voidCrateExport(voidTarget.exportNo);
        const exportNo = voidTarget.exportNo;
        setVoidTarget(null);
        setSuccessMessage(`归还单 ${exportNo} 已作废 ✓`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "作废失败 Void failed");
      }
    });
  }

  return (
    <>
      <SuccessBanner
        message={successMessage}
        onDismiss={() => setSuccessMessage(null)}
      />

      <div className="overflow-x-auto rounded-xl border border-haidee-border bg-white">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
              <th className="whitespace-nowrap px-4 py-3 text-left font-medium">
                日期 Date
              </th>
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
              <th className="whitespace-nowrap px-4 py-3 text-right font-medium">
                操作
              </th>
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
                <td
                  className="max-w-[200px] truncate px-4 py-3"
                  title={row.shipperName}
                >
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
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link
                      href={buildReprintHref(row.exportNo, listDate)}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-haidee-blue px-3 text-sm text-haidee-blue transition-colors hover:bg-haidee-blue/10"
                    >
                      重打 Reprint
                    </Link>
                    {userCanWrite ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => {
                          setError(null);
                          setVoidTarget(row);
                        }}
                        className="min-h-[36px] border-haidee-red text-haidee-red hover:bg-haidee-red/10"
                      >
                        作废 Void
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={voidTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setVoidTarget(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>作废归还单 Void Export</DialogTitle>
            <DialogDescription>
              确认作废归还单 {voidTarget?.exportNo}？将退回客户桶库存并删除整张单，不可恢复。
              <br />
              Void export {voidTarget?.exportNo}? Customer crate stock will be
              reversed and all lines deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-haidee-red" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVoidTarget(null);
                setError(null);
              }}
              disabled={isPending}
            >
              取消 Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoidConfirm}
              disabled={isPending}
              className="bg-haidee-red hover:bg-haidee-red/90"
            >
              {isPending ? "处理中…" : "确认作废 Confirm Void"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

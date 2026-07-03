"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { voidCrateExport } from "@/app/actions/crateExport";
import { SuccessBanner } from "@/components/shared/SuccessBanner";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { useCanWrite } from "@/components/shared/can-write-context";
import { useT } from "@/components/shared/locale-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplay } from "@/lib/date-utils";
import type { CrateExportListRow } from "@/lib/crate-export-list";
import {
  stickyActionsColTableClass,
  stickyFirstColTableClass,
} from "@/lib/table-scroll";
import { cn } from "@/lib/utils";

interface CrateExportListTableProps {
  rows: CrateExportListRow[];
  /** yyyy-MM-dd — used in reprint returnTo link */
  listDate: string;
}

function buildEditHref(exportNo: string): string {
  return `/crate/export/edit?exportNo=${encodeURIComponent(exportNo)}`;
}

function buildReprintHref(exportNo: string, listDate: string): string {
  const returnTo = `/crate/export?date=${encodeURIComponent(listDate)}`;
  return `/crate/export/print?exportNo=${encodeURIComponent(exportNo)}&returnTo=${encodeURIComponent(returnTo)}`;
}

export function CrateExportListTable({ rows, listDate }: CrateExportListTableProps) {
  const router = useRouter();
  const { t, tLocal, parts } = useT();
  const userCanWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  const [voidTarget, setVoidTarget] = useState<CrateExportListRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-haidee-border bg-haidee-surface/30 p-10 text-center text-sm text-haidee-muted">
        {t("crateExport.emptyList")}
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
        setSuccessMessage(
          t("crateExport.voidSuccess", { exportNo })
        );
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : t("crateExport.error.voidFailed")
        );
      }
    });
  }

  return (
    <>
      <SuccessBanner
        message={successMessage}
        onDismiss={() => setSuccessMessage(null)}
      />

      <ScrollMatrixTable heightOffset={520} className="rounded-lg border-0">
        <Table
          noScrollContainer
          className={cn(
            "text-sm",
            stickyFirstColTableClass,
            stickyActionsColTableClass
          )}
        >
          <TableHeader>
          <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
            <TableHead className="whitespace-nowrap px-4 py-3 text-left font-medium text-haidee-muted">
              {t("common.date")}
            </TableHead>
            <TableHead className="whitespace-nowrap px-4 py-3 text-left font-medium text-haidee-muted">
              {t("crateExport.teNo")}
            </TableHead>
            <TableHead className="whitespace-nowrap px-4 py-3 text-left font-medium text-haidee-muted">
              {t("common.consignor")}
            </TableHead>
            <TableHead className="whitespace-nowrap px-4 py-3 text-left font-medium text-haidee-muted">
              {t("dispatch.plateField")}
            </TableHead>
            <TableHead className="whitespace-nowrap px-4 py-3 text-right font-medium text-haidee-muted">
              {t("common.total")} ({parts("common.crateUnit").local})
            </TableHead>
            <TableHead className="whitespace-nowrap px-4 py-3 text-right font-medium text-haidee-muted">
              {t("common.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.exportNo}
              className="border-b border-haidee-border/60 hover:bg-haidee-surface/40"
            >
              <TableCell className="whitespace-nowrap px-4 py-3">
                {formatDisplay(row.date)}
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 py-3 font-mono text-haidee-text">
                {row.exportNo}
              </TableCell>
              <TableCell
                className="max-w-[200px] truncate px-4 py-3"
                title={row.shipperName}
              >
                {row.shipperName}
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 py-3 font-mono">
                {row.thVehiclePlate}
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold">
                {row.totalActual}
                {row.totalShortage > 0 ? (
                  <span className="ml-2 text-xs font-normal text-haidee-red">
                    {t("crateExport.shortageBadge", {
                      n: String(row.totalShortage),
                    })}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 py-3 text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  <Link
                    href={buildReprintHref(row.exportNo, listDate)}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-haidee-blue px-3 text-sm text-haidee-blue transition-colors hover:bg-haidee-blue/10"
                  >
                    {t("crateExport.reprint")}
                  </Link>
                  {userCanWrite ? (
                    <>
                      <Link
                        href={buildEditHref(row.exportNo)}
                        className="inline-flex min-h-[36px] items-center rounded-lg border border-haidee-border px-3 text-sm text-haidee-text transition-colors hover:bg-haidee-surface"
                      >
                        {t("common.edit")}
                      </Link>
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
                        {t("crateExport.void")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        </Table>
      </ScrollMatrixTable>

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
            <DialogTitle>{t("crateExport.voidTitle")}</DialogTitle>
            <DialogDescription>
              {tLocal("crateExport.voidConfirm")}
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
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoidConfirm}
              disabled={isPending}
              className="bg-haidee-red hover:bg-haidee-red/90"
            >
              {isPending ? t("common.processing") : t("crateExport.confirmVoid")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

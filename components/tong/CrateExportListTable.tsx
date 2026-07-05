"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
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
  STICKY_BODY_ACTIONS,
  STICKY_BODY_FIRST,
  STICKY_HEAD_ACTIONS,
  STICKY_HEAD_FIRST,
  STICKY_HEAD_TOP,
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
  const [expandedExportNo, setExpandedExportNo] = useState<string | null>(null);

  function handleVoidConfirm() {
    if (!voidTarget) return;
    setError(null);
    startTransition(async () => {
      try {
        await voidCrateExport(voidTarget.exportNo);
        const exportNo = voidTarget.exportNo;
        setVoidTarget(null);
        setSuccessMessage(t("crateExport.voidSuccess", { exportNo }));
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : t("crateExport.error.voidFailed")
        );
      }
    });
  }

  function toggleExpand(exportNo: string, canExpand: boolean) {
    if (!canExpand) return;
    setExpandedExportNo((prev) => (prev === exportNo ? null : exportNo));
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-haidee-border bg-haidee-surface/30 p-10 text-center text-sm text-haidee-muted">
        {t("crateExport.emptyList")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SuccessBanner
        message={successMessage}
        onDismiss={() => setSuccessMessage(null)}
      />

      <ScrollMatrixTable
        heightOffset={300}
        className="rounded-lg border-0"
        innerClassName="crate-export-list-scroll"
      >
        <Table noScrollContainer className="min-w-[1200px] text-sm">
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead
                className={cn(
                  STICKY_HEAD_FIRST,
                  "whitespace-nowrap px-4 py-3 text-left font-medium text-haidee-muted"
                )}
              >
                {t("common.date")}
              </TableHead>
              <TableHead
                className={cn(
                  STICKY_HEAD_TOP,
                  "whitespace-nowrap px-4 py-3 text-left font-medium text-haidee-muted"
                )}
              >
                {t("crateExport.teNo")}
              </TableHead>
              <TableHead
                className={cn(
                  STICKY_HEAD_TOP,
                  "whitespace-nowrap px-4 py-3 text-left font-medium text-haidee-muted"
                )}
              >
                {t("common.consignor")}
              </TableHead>
              <TableHead
                className={cn(
                  STICKY_HEAD_TOP,
                  "whitespace-nowrap px-4 py-3 text-left font-medium text-haidee-muted"
                )}
              >
                {t("dispatch.plateField")}
              </TableHead>
              <TableHead
                className={cn(
                  STICKY_HEAD_TOP,
                  "whitespace-nowrap px-4 py-3 text-right font-medium text-haidee-muted"
                )}
              >
                {t("common.total")} ({parts("common.crateUnit").local})
              </TableHead>
              <TableHead
                className={cn(
                  STICKY_HEAD_ACTIONS,
                  "whitespace-nowrap px-4 py-3 text-right font-medium text-haidee-muted"
                )}
              >
                {t("common.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isExpanded = expandedExportNo === row.exportNo;
              const canExpand = row.hasSuggestedActualMismatch;

              return (
                <Fragment key={row.exportNo}>
                  <TableRow
                    className={cn(
                      "border-b border-haidee-border/60 hover:bg-haidee-surface/40",
                      row.hasSuggestedActualMismatch &&
                        "bg-orange-50 hover:bg-orange-50/80"
                    )}
                  >
                    <TableCell
                      className={cn(
                        STICKY_BODY_FIRST,
                        "whitespace-nowrap px-4 py-3",
                        row.hasSuggestedActualMismatch && "bg-orange-50"
                      )}
                    >
                      {formatDisplay(row.date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-3 font-mono text-haidee-text">
                      <div className="flex flex-col gap-1">
                        <span>{row.exportNo}</span>
                        {row.hasSuggestedActualMismatch ? (
                          <button
                            type="button"
                            onClick={() => toggleExpand(row.exportNo, canExpand)}
                            className="w-fit text-left text-xs font-normal text-orange-700 underline-offset-2 hover:underline"
                          >
                            {t("crateExport.suggestedActualMismatch")}
                            {isExpanded
                              ? ` (${t("crateExport.collapseMismatch")})`
                              : ` (${t("crateExport.expandMismatch")})`}
                          </button>
                        ) : null}
                      </div>
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
                    <TableCell
                      className={cn(
                        STICKY_BODY_ACTIONS,
                        "whitespace-nowrap px-4 py-3 text-right",
                        row.hasSuggestedActualMismatch && "bg-orange-50"
                      )}
                    >
                      <div className="flex flex-nowrap justify-end gap-2">
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
                  {isExpanded ? (
                    <TableRow className="bg-orange-50/60 hover:bg-orange-50/60">
                      <TableCell colSpan={6} className="px-4 py-3">
                        <div className="overflow-x-auto rounded-lg border border-orange-200 bg-white/80">
                          <Table className="text-sm">
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t("crateExport.crateType")}</TableHead>
                                <TableHead className="text-right">
                                  {t("crateExport.suggested")}
                                </TableHead>
                                <TableHead className="text-right">
                                  {t("crateExport.actual")}
                                </TableHead>
                                <TableHead className="text-right">
                                  {t("crateExport.suggestedActualDiff")}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {row.lines.map((line) => {
                                const diff =
                                  line.quantitySuggested - line.quantityActual;
                                return (
                                  <TableRow key={line.tongCode}>
                                    <TableCell className="font-mono">
                                      {line.tongCode}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {line.quantitySuggested}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                      {line.quantityActual}
                                    </TableCell>
                                    <TableCell
                                      className={cn(
                                        "text-right font-mono",
                                        diff !== 0 && "font-semibold text-orange-700"
                                      )}
                                    >
                                      {diff > 0 ? `+${diff}` : String(diff)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
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
    </div>
  );
}

"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import type { PattaniContractorMonthlySummary } from "@/lib/thai-cost/pattani-contractor-monthly";
import { useT } from "@/components/shared/locale-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrintLetterhead } from "@/components/shared/PrintLogo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplay } from "@/lib/date-utils";
import "@/components/documents/document-print.css";

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function PattaniContractorMonthlyView({
  summary,
  canPrint,
}: {
  summary: PattaniContractorMonthlySummary;
  canPrint: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { tLocal } = useT();

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          {tLocal("thaiCost.common.year")}
          <Input
            type="number"
            className="w-24"
            value={summary.year}
            onChange={(e) =>
              router.push(
                `/thai-cost/pattani-contractor-monthly?year=${Number(e.target.value) || summary.year}&month=${summary.month}`
              )
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          {tLocal("thaiCost.common.month")}
          <Input
            type="number"
            min={1}
            max={12}
            className="w-20"
            value={summary.month}
            onChange={(e) =>
              router.push(
                `/thai-cost/pattani-contractor-monthly?year=${summary.year}&month=${Number(e.target.value) || summary.month}`
              )
            }
          />
        </label>
        {canPrint && (
          <Button
            type="button"
            className="gap-2 bg-haidee-blue text-white"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            {tLocal("thaiCost.common.print")}
          </Button>
        )}
      </div>

      <div
        ref={printRef}
        className="document-print rounded-lg border bg-white p-6"
      >
        <PrintLetterhead />
        <h2 className="mt-4 text-center text-lg font-bold">
          {tLocal("thaiCost.pattaniContractorMonthly.pageTitle")}
        </h2>
        <p className="text-center text-sm text-haidee-muted">
          {summary.year}-{String(summary.month).padStart(2, "0")}
        </p>
        <p className="mt-2 text-center text-sm">
          {tLocal("thaiCost.pattaniContractorMonthly.rateNote", {
            crateRate: String(summary.crateRate),
            boxRate: String(summary.boxRate),
          })}
        </p>

        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>{tLocal("thaiCost.common.date")}</TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.pattaniHandling.colCrates")}
              </TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.pattaniHandling.colBoxes")}
              </TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.pattaniHandling.colContractor")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.days.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-haidee-muted">
                  {tLocal("thaiCost.common.noRecordsThisMonth")}
                </TableCell>
              </TableRow>
            ) : (
              summary.days.map((day) => (
                <TableRow key={day.date}>
                  <TableCell>{formatDisplay(day.date)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {day.crateQty}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {day.boxQty}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {money(day.contractorThb)}
                  </TableCell>
                </TableRow>
              ))
            )}
            {summary.days.length > 0 && (
              <TableRow className="font-semibold">
                <TableCell>{tLocal("thaiCost.pattaniContractorMonthly.totalPayable")}</TableCell>
                <TableCell className="text-right font-mono">
                  {summary.totalCrates}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {summary.totalBoxes}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {money(summary.totalContractorThb)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  getCharterMonthlyLedger,
  type CharterMonthlyLedgerRow,
} from "@/app/actions/charter";
import { ReportFilterBar } from "@/components/shared/ReportFilterBar";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { YearMonthFields } from "@/components/shared/YearMonthFields";
import { useT } from "@/components/shared/locale-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplay } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface YearMonthDraft {
  year: number;
  month: number;
}

function formatLocationLabel(label: string) {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : "—";
}

function formatLedgerMyr(value: number) {
  return `${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MYR`;
}

interface CharterMonthlyLedgerProps {
  initialYear: number;
  initialMonth: number;
}

export function CharterMonthlyLedger({
  initialYear,
  initialMonth,
}: CharterMonthlyLedgerProps) {
  const router = useRouter();
  const { t } = useT();
  const autoLoaded = useRef(false);

  const defaultDraft = useMemo(
    (): YearMonthDraft => ({
      year: initialYear,
      month: initialMonth,
    }),
    [initialMonth, initialYear]
  );

  const [draft, setDraft] = useState<YearMonthDraft>(defaultDraft);
  const [applied, setApplied] = useState<YearMonthDraft | null>(null);
  const [rows, setRows] = useState<CharterMonthlyLedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadLedger = useCallback(async (filters: YearMonthDraft) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCharterMonthlyLedger(filters);
      setRows(data.rows);
      setApplied(filters);
      setHasLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("charter.monthlyLedger.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    void loadLedger(defaultDraft);
  }, [defaultDraft, loadLedger]);

  const filtersDirty =
    hasLoaded &&
    applied !== null &&
    (draft.year !== applied.year || draft.month !== applied.month);

  return (
    <section className="space-y-4 border-t border-haidee-border pt-6">
      <div>
        <h3 className="text-lg font-semibold text-haidee-text">
          {t("charter.monthlyLedger.title")}
        </h3>
        <p className="text-sm text-haidee-muted">
          {t("charter.monthlyLedger.subtitle")}
        </p>
      </div>

      <ReportFilterBar loading={loading} onSearch={() => void loadLedger(draft)}>
        <YearMonthFields
          year={draft.year}
          month={draft.month}
          onYearChange={(year) => setDraft((prev) => ({ ...prev, year }))}
          onMonthChange={(month) => setDraft((prev) => ({ ...prev, month }))}
        />
      </ReportFilterBar>

      {filtersDirty ? (
        <p className="text-sm text-amber-800">
          {t("charter.monthlyLedger.filtersChanged")}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {!hasLoaded && loading ? (
        <p className="flex items-center gap-2 text-sm text-haidee-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("charter.monthlyLedger.loading")}
        </p>
      ) : !hasLoaded ? null : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-haidee-border bg-white px-4 py-8 text-center text-sm text-haidee-muted">
          {t("charter.monthlyLedger.empty")}
        </p>
      ) : (
        <ScrollMatrixTable heightOffset={420}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("charter.monthlyLedger.col.date")}</TableHead>
                <TableHead>{t("charter.monthlyLedger.col.charterNo")}</TableHead>
                <TableHead>{t("charter.monthlyLedger.col.plate")}</TableHead>
                <TableHead>{t("charter.monthlyLedger.col.customer")}</TableHead>
                <TableHead>{t("charter.monthlyLedger.col.location")}</TableHead>
                <TableHead className="text-right">
                  {t("charter.monthlyLedger.col.revenue")}
                </TableHead>
                <TableHead className="text-right">
                  {t("charter.monthlyLedger.col.grossProfit")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-haidee-surface/60"
                  onClick={() => router.push(`/charter/${row.id}`)}
                >
                  <TableCell>{formatDisplay(row.date)}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.charterNo ?? "—"}
                  </TableCell>
                  <TableCell>{row.truckPlate}</TableCell>
                  <TableCell>{row.customerName}</TableCell>
                  <TableCell>{formatLocationLabel(row.locationLabel)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatLedgerMyr(row.revenueMyr)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono",
                      row.grossProfitMyr < 0 && "text-destructive"
                    )}
                  >
                    {formatLedgerMyr(row.grossProfitMyr)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollMatrixTable>
      )}
    </section>
  );
}

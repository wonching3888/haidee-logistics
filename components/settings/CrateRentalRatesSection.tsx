"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveCrateRentalRates } from "@/app/actions/crate-rental-rates";

export interface CrateRentalRateRow {
  id: string;
  crateType: string;
  isRental: boolean;
  rateMyr: number;
  notes: string | null;
}

interface CrateRentalRatesSectionProps {
  rates: CrateRentalRateRow[];
}

export function CrateRentalRatesSection({ rates }: CrateRentalRatesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState<Record<string, string>>({});
  const [notesForm, setNotesForm] = useState<Record<string, string>>({});

  useEffect(() => {
    setRateForm(
      Object.fromEntries(
        rates.map((row) => [
          row.crateType,
          row.isRental ? String(row.rateMyr) : "",
        ])
      )
    );
    setNotesForm(
      Object.fromEntries(rates.map((row) => [row.crateType, row.notes ?? ""]))
    );
    setSuccess(null);
  }, [rates]);

  function parseRate(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} 费率不能为负数`);
    }
    return parsed;
  }

  function runSave() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await saveCrateRentalRates({
          rates: rates.map((row) => ({
            crateType: row.crateType,
            rateMyr: row.isRental
              ? parseRate(rateForm[row.crateType] ?? "", row.crateType)
              : 0,
            notes: notesForm[row.crateType] ?? "",
          })),
        });
        setSuccess("租桶费率已保存 Crate rental rates saved.");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="rounded-lg border border-haidee-border bg-white p-4">
      <h3 className="mb-3 text-base font-semibold text-haidee-text">
        租桶费率 Crate Rental Rates (MYR/桶)
      </h3>

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {success && (
        <p className="mb-3 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-haidee-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>桶型 Crate Type</TableHead>
              <TableHead>类型 Type</TableHead>
              <TableHead>费率 Rate (MYR)</TableHead>
              <TableHead>备注 Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono font-medium">
                  {row.crateType}
                </TableCell>
                <TableCell>
                  {row.isRental ? (
                    <Badge className="border-transparent bg-haidee-blue/10 text-haidee-blue hover:bg-haidee-blue/10">
                      租桶 Rental
                    </Badge>
                  ) : (
                    <Badge variant="secondary">自有 Own</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {row.isRental ? (
                    <Input
                      value={rateForm[row.crateType] ?? ""}
                      onChange={(e) =>
                        setRateForm({
                          ...rateForm,
                          [row.crateType]: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      className="min-h-[44px] w-[120px] font-mono"
                    />
                  ) : (
                    <span className="inline-flex min-h-[44px] w-[120px] items-center justify-end rounded-md bg-gray-100 px-3 font-mono text-sm text-haidee-muted">
                      —
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    value={notesForm[row.crateType] ?? ""}
                    onChange={(e) =>
                      setNotesForm({
                        ...notesForm,
                        [row.crateType]: e.target.value,
                      })
                    }
                    placeholder="备注"
                    className="min-h-[44px]"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          className="bg-haidee-blue text-white"
          disabled={isPending}
          onClick={runSave}
        >
          保存 Save
        </Button>
      </div>
    </div>
  );
}

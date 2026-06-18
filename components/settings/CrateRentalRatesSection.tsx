"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveCrateRentalRates } from "@/app/actions/crate-rental-rates";
import type { CrateRentalCurrency } from "@/lib/crate-rental-cost";
import { CRATE_RENTAL_CURRENCIES } from "@/lib/crate-rental-cost";

export interface CrateRentalRateRow {
  id: string;
  crateType: string;
  isRental: boolean;
  rate: number;
  currency: CrateRentalCurrency;
  notes: string | null;
}

interface CrateRentalRatesSectionProps {
  rates: CrateRentalRateRow[];
}

export function CrateRentalRatesSection({
  rates: initialRates,
}: CrateRentalRatesSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rates, setRates] = useState(initialRates);
  const [loading, setLoading] = useState(initialRates.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState<Record<string, string>>({});
  const [currencyForm, setCurrencyForm] = useState<
    Record<string, CrateRentalCurrency>
  >({});
  const [notesForm, setNotesForm] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadRates() {
      setLoading(true);
      try {
        const response = await fetch("/api/settings/crate-rental-rates");
        if (!response.ok) {
          throw new Error("无法加载租桶费率 Failed to load crate rental rates");
        }
        const data = (await response.json()) as { rates?: CrateRentalRateRow[] };
        if (!cancelled && Array.isArray(data.rates)) {
          setRates(data.rates);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRates();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRateForm(
      Object.fromEntries(
        rates.map((row) => [
          row.crateType,
          row.isRental ? String(row.rate) : "",
        ])
      )
    );
    setCurrencyForm(
      Object.fromEntries(rates.map((row) => [row.crateType, row.currency]))
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
            isRental: row.isRental,
            rate: row.isRental
              ? parseRate(rateForm[row.crateType] ?? "", row.crateType)
              : 0,
            currency: currencyForm[row.crateType] ?? "MYR",
            notes: notesForm[row.crateType] ?? "",
          })),
        });
        setSuccess("租桶费率已保存 Crate rental rates saved.");
        const refreshed = await fetch("/api/settings/crate-rental-rates");
        if (refreshed.ok) {
          const data = (await refreshed.json()) as { rates?: CrateRentalRateRow[] };
          if (Array.isArray(data.rates)) {
            setRates(data.rates);
          }
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="rounded-lg border border-haidee-border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-haidee-text">
          租桶费率 Crate Rental Rates
        </h3>
        <Link
          href="/reports/crate-rental"
          className="text-sm font-medium text-haidee-blue hover:underline"
        >
          租桶月结对账 Crate Rental Statement →
        </Link>
      </div>

      {loading && (
        <p className="mb-3 text-sm text-haidee-muted">加载租桶费率中…</p>
      )}

      {!loading && rates.length === 0 && (
        <p className="mb-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          租桶费率表尚未创建。请先以管理员身份访问{" "}
          <code className="font-mono">/api/setup/create-crate-rental-rates</code>{" "}
          完成建表，然后刷新本页。
        </p>
      )}

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
              <TableHead>币种 Currency</TableHead>
              <TableHead>费率 Rate</TableHead>
              <TableHead>备注 Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((row) => {
              const currency = currencyForm[row.crateType] ?? row.currency;
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-mono font-medium">
                    {row.crateType}
                  </TableCell>
                  <TableCell>
                    <select
                      value={row.isRental ? "rental" : "own"}
                      onChange={(e) =>
                        setRates((prev) =>
                          prev.map((item) =>
                            item.id === row.id
                              ? {
                                  ...item,
                                  isRental: e.target.value === "rental",
                                }
                              : item
                          )
                        )
                      }
                      className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
                    >
                      <option value="rental">租桶 Rental</option>
                      <option value="own">自有 Own</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    {row.isRental ? (
                      <select
                        value={currency}
                        onChange={(e) =>
                          setCurrencyForm({
                            ...currencyForm,
                            [row.crateType]: e.target.value as CrateRentalCurrency,
                          })
                        }
                        className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
                      >
                        {CRATE_RENTAL_CURRENCIES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-haidee-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.isRental ? (
                      <div className="flex items-center gap-2">
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
                        <span className="text-xs text-haidee-muted">
                          /桶 {currency}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex min-h-[44px] w-[120px] items-center justify-end rounded-md bg-gray-100 px-3 font-mono text-sm text-haidee-muted">
                        0.00
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
              );
            })}
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

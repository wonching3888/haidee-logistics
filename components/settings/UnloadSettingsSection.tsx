"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { stickyFirstColTableClass } from "@/lib/table-scroll";
import { saveUnloadRates } from "@/app/actions/unload-rates";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import {
  UNLOAD_CRATE_TYPES,
  unloadRateKey,
} from "@/lib/constants/unload-rates";

export interface UnloadRateMatrixRow {
  marketCode: string;
  rates: {
    id: string;
    marketCode: string;
    crateType: string;
    rateMyr: number;
    notes: string | null;
  }[];
}

interface UnloadSettingsSectionProps {
  matrix: UnloadRateMatrixRow[];
}

export function UnloadSettingsSection({
  matrix: initialMatrix,
}: UnloadSettingsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [matrix, setMatrix] = useState(initialMatrix);
  const [loading, setLoading] = useState(initialMatrix.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rateForm, setRateForm] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadMatrix() {
      setLoading(true);
      try {
        const response = await fetch("/api/settings/unload-rates");
        if (!response.ok) {
          throw new Error("无法加载下货费 Failed to load unload rates");
        }
        const data = (await response.json()) as {
          matrix?: UnloadRateMatrixRow[];
        };
        if (!cancelled && Array.isArray(data.matrix)) {
          setMatrix(data.matrix);
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

    loadMatrix();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRateForm(
      Object.fromEntries(
        matrix.flatMap((row) =>
          row.rates.map((rate) => [
            unloadRateKey(rate.marketCode, rate.crateType),
            String(rate.rateMyr),
          ])
        )
      )
    );
    setSuccess(null);
  }, [matrix]);

  function parseRate(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} 不能为负数`);
    }
    return parsed;
  }

  function runSave() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await saveUnloadRates({
          rates: matrix.flatMap((row) =>
            row.rates.map((rate) => ({
              marketCode: rate.marketCode,
              crateType: rate.crateType,
              rateMyr: parseRate(
                rateForm[unloadRateKey(rate.marketCode, rate.crateType)] ?? "",
                `${rate.marketCode} ${rate.crateType}`
              ),
            }))
          ),
        });
        setSuccess("下货费已保存 Unload rates saved.");
        const refreshed = await fetch("/api/settings/unload-rates");
        if (refreshed.ok) {
          const data = (await refreshed.json()) as {
            matrix?: UnloadRateMatrixRow[];
          };
          if (Array.isArray(data.matrix)) {
            setMatrix(data.matrix);
          }
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        下货费 Load/Unload (MYR/桶)，按市场 × 桶型设定。运营报表按派车明细自动计算。
      </p>

      {loading && (
        <p className="text-sm text-haidee-muted">加载下货费中…</p>
      )}

      {!loading && matrix.length === 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          下货费表尚未创建。请运行{" "}
          <code className="font-mono">scripts/create-unload-rates.ts</code>{" "}
          或访问{" "}
          <code className="font-mono">/api/setup/create-unload-rates</code>{" "}
          完成建表，然后刷新本页。
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </p>
      )}

      {matrix.length > 0 && (
        <ScrollMatrixTable heightOffset={380} className="rounded-lg">
          <Table className={stickyFirstColTableClass}>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead className="sticky left-0 z-20 bg-haidee-surface">
                  市场 Market
                </TableHead>
                {UNLOAD_CRATE_TYPES.map((crateType) => (
                  <TableHead key={crateType} className="min-w-[88px] text-center">
                    {crateType}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.map((row) => (
                <TableRow key={row.marketCode}>
                  <TableCell className="sticky left-0 z-10 bg-white">
                    <div className="font-mono font-medium">{row.marketCode}</div>
                    <div className="text-xs text-haidee-muted">
                      {getMarketDisplayName(row.marketCode)}
                    </div>
                  </TableCell>
                  {row.rates.map((rate) => {
                    const key = unloadRateKey(rate.marketCode, rate.crateType);
                    return (
                      <TableCell key={key} className="p-1">
                        <Input
                          value={rateForm[key] ?? ""}
                          onChange={(e) =>
                            setRateForm({
                              ...rateForm,
                              [key]: e.target.value,
                            })
                          }
                          placeholder="0.00"
                          className="min-h-[40px] w-[80px] px-2 font-mono"
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollMatrixTable>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          className="bg-haidee-blue text-white"
          disabled={isPending || matrix.length === 0}
          onClick={runSave}
        >
          保存 Save
        </Button>
      </div>
    </div>
  );
}

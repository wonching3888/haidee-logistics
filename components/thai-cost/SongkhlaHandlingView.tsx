"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteSongkhlaHandling,
  getStationDispatchTotalsForDate,
  saveSongkhlaHandling,
  type SongkhlaHandlingRow,
} from "@/app/actions/thai-cost-phase2";
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
import { formatDisplay } from "@/lib/date-utils";

export function SongkhlaHandlingView({
  year,
  month,
  rows,
  canWrite,
}: {
  year: number;
  month: number;
  rows: SongkhlaHandlingRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [dispatchTotals, setDispatchTotals] = useState({
    smallCrateTotalQty: 0,
    largeCrateTotalQty: 0,
    boxTotalQty: 0,
  });
  const [loadingDispatch, setLoadingDispatch] = useState(false);
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    notes: "",
  });

  useEffect(() => {
    if (!showForm || !form.date) return;
    let cancelled = false;
    setLoadingDispatch(true);
    getStationDispatchTotalsForDate(form.date, "SONGKHLA")
      .then((totals) => {
        if (!cancelled) {
          setDispatchTotals({
            smallCrateTotalQty: totals.smallCrateTotalQty,
            largeCrateTotalQty: totals.largeCrateTotalQty,
            boxTotalQty: totals.boxTotalQty,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDispatchTotals({
            smallCrateTotalQty: 0,
            largeCrateTotalQty: 0,
            boxTotalQty: 0,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDispatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showForm, form.date]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        宋卡搬运：总数从派车自动拉取（pickup=SONGKHLA，assigned 行）。
        无「直达」扣减；计费数=总数。一律平日费率。
      </p>
      <div className="flex flex-wrap gap-3">
        <Input
          type="number"
          className="w-24"
          value={year}
          onChange={(e) =>
            router.push(
              `/thai-cost/songkhla-handling?year=${Number(e.target.value) || year}&month=${month}`
            )
          }
        />
        <Input
          type="number"
          className="w-20"
          min={1}
          max={12}
          value={month}
          onChange={(e) =>
            router.push(
              `/thai-cost/songkhla-handling?year=${year}&month=${Number(e.target.value) || month}`
            )
          }
        />
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}
      {canWrite && !showForm && (
        <Button
          type="button"
          className="gap-1 bg-haidee-blue text-white"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4" /> 登记 / 刷新当日
        </Button>
      )}
      {canWrite && showForm && (
        <form
          className="space-y-3 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await saveSongkhlaHandling({
                  date: form.date,
                  notes: form.notes || null,
                });
                setShowForm(false);
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "失败");
              }
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              日期
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              备注
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </label>
          </div>
          <div className="rounded-md bg-haidee-surface/60 px-3 py-2 text-sm">
            <p className="font-medium text-haidee-text">
              派车总数（只读，pickup=SONGKHLA）
            </p>
            {loadingDispatch ? (
              <p className="text-haidee-muted">加载中…</p>
            ) : (
              <p className="font-mono">
                小 {dispatchTotals.smallCrateTotalQty} / 大{" "}
                {dispatchTotals.largeCrateTotalQty} / 盒{" "}
                {dispatchTotals.boxTotalQty}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isPending || loadingDispatch}
              className="bg-haidee-blue text-white"
            >
              保存
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              取消
            </Button>
          </div>
        </form>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>日期</TableHead>
            <TableHead className="text-right">小/大/盒</TableHead>
            <TableHead className="text-right">提成</TableHead>
            {canWrite && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatDisplay(r.date)}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {r.smallCrateTotalQty}/{r.largeCrateTotalQty}/{r.boxTotalQty}
              </TableCell>
              <TableCell className="text-right font-mono">
                {r.commissionThb.toFixed(2)}
              </TableCell>
              {canWrite && (
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteSongkhlaHandling(r.id);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-haidee-red" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

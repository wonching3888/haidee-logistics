"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteSongkhlaHandling,
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
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    small: "",
    large: "",
    box: "0",
    notes: "",
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        宋卡搬运：无不过车排除，计费数=总数。一律平日费率（小桶/盒子与大桶，无假日/OT
        档；宋卡固定周日休息）。费率来自设置页，月度快照锁定。
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
      {canWrite && (
        <form
          className="grid gap-2 rounded-lg border p-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await saveSongkhlaHandling({
                  date: form.date,
                  smallCrateTotalQty: Number(form.small),
                  largeCrateTotalQty: Number(form.large),
                  boxTotalQty: Number(form.box),
                  notes: form.notes || null,
                });
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "失败");
              }
            });
          }}
        >
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            required
          />
          <Input
            type="number"
            min={0}
            placeholder="小桶"
            value={form.small}
            onChange={(e) => setForm((f) => ({ ...f, small: e.target.value }))}
            required
          />
          <Input
            type="number"
            min={0}
            placeholder="大桶"
            value={form.large}
            onChange={(e) => setForm((f) => ({ ...f, large: e.target.value }))}
            required
          />
          <Input
            type="number"
            min={0}
            placeholder="盒子"
            value={form.box}
            onChange={(e) => setForm((f) => ({ ...f, box: e.target.value }))}
            required
          />
          <Button
            type="submit"
            disabled={isPending}
            className="gap-1 bg-haidee-blue text-white"
          >
            <Plus className="h-4 w-4" /> 保存
          </Button>
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

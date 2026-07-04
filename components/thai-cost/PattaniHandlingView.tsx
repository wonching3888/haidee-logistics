"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  deletePattaniHandling,
  savePattaniHandling,
  type PattaniHandlingRow,
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

export function PattaniHandlingView({
  year,
  month,
  rows,
  canWrite,
}: {
  year: number;
  month: number;
  rows: PattaniHandlingRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    crateQty: "",
    boxQty: "0",
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        北大年搬运：同一批桶数同时算出外包费用与 SAKRI
        提成。无假日/OT。盒子只计入外包（5 THB），不计入 SAKRI。
      </p>
      <div className="flex flex-wrap gap-3">
        <Input
          type="number"
          className="w-24"
          value={year}
          onChange={(e) =>
            router.push(
              `/thai-cost/pattani-handling?year=${Number(e.target.value) || year}&month=${month}`
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
              `/thai-cost/pattani-handling?year=${year}&month=${Number(e.target.value) || month}`
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
          className="grid gap-2 rounded-lg border p-3 sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await savePattaniHandling({
                  date: form.date,
                  crateQty: Number(form.crateQty),
                  boxQty: Number(form.boxQty),
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
            placeholder="桶数"
            value={form.crateQty}
            onChange={(e) =>
              setForm((f) => ({ ...f, crateQty: e.target.value }))
            }
            required
          />
          <Input
            type="number"
            min={0}
            placeholder="盒子"
            value={form.boxQty}
            onChange={(e) => setForm((f) => ({ ...f, boxQty: e.target.value }))}
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
            <TableHead className="text-right">桶数</TableHead>
            <TableHead className="text-right">盒子</TableHead>
            <TableHead className="text-right">外包费用</TableHead>
            <TableHead className="text-right">SAKRI 提成</TableHead>
            <TableHead className="text-right">当日合计</TableHead>
            {canWrite && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatDisplay(r.date)}</TableCell>
              <TableCell className="text-right">{r.crateQty}</TableCell>
              <TableCell className="text-right">{r.boxQty}</TableCell>
              <TableCell className="text-right font-mono">
                {r.contractorThb.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {r.sakriCommissionThb.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono font-medium">
                {r.dayTotalThb.toFixed(2)}
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
                        await deletePattaniHandling(r.id);
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

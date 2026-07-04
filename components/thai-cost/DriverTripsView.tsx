"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteThaiDriverTrip,
  saveThaiDriverTrip,
  type ThaiDriverRow,
  type ThaiDriverTripRow,
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

export function DriverTripsView({
  year,
  month,
  drivers,
  trips,
  canWrite,
}: {
  year: number;
  month: number;
  drivers: ThaiDriverRow[];
  trips: ThaiDriverTripRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    driverId: drivers[0]?.id ?? "",
    songkhla: "0",
    pattani: "0",
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        司机每日趟次：宋卡提成 / 北大年提成费率见设置页。底薪在宋卡 P&L
        中按当月趟次比例分摊。
      </p>
      <div className="rounded-lg border p-3 text-sm">
        <p className="font-medium">司机名单</p>
        <ul className="mt-1 space-y-0.5">
          {drivers.map((d) => (
            <li key={d.id} className="flex justify-between font-mono text-xs">
              <span>{d.name}</span>
              <span>底薪 {d.baseWage}</span>
            </li>
          ))}
        </ul>
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}
      {canWrite && drivers.length > 0 && (
        <form
          className="grid gap-2 rounded-lg border p-3 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await saveThaiDriverTrip({
                  date: form.date,
                  driverId: form.driverId,
                  songkhlaTripCount: Number(form.songkhla),
                  pattaniTripCount: Number(form.pattani),
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
          <select
            className="h-8 rounded-lg border px-2 text-sm"
            value={form.driverId}
            onChange={(e) =>
              setForm((f) => ({ ...f, driverId: e.target.value }))
            }
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={0}
            placeholder="宋卡趟"
            value={form.songkhla}
            onChange={(e) =>
              setForm((f) => ({ ...f, songkhla: e.target.value }))
            }
            required
          />
          <Input
            type="number"
            min={0}
            placeholder="北大年趟"
            value={form.pattani}
            onChange={(e) =>
              setForm((f) => ({ ...f, pattani: e.target.value }))
            }
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
            <TableHead>司机</TableHead>
            <TableHead className="text-right">宋卡</TableHead>
            <TableHead className="text-right">北大年</TableHead>
            <TableHead className="text-right">提成</TableHead>
            {canWrite && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.map((t) => (
            <TableRow key={t.id}>
              <TableCell>{formatDisplay(t.date)}</TableCell>
              <TableCell>{t.driverName}</TableCell>
              <TableCell className="text-right">{t.songkhlaTripCount}</TableCell>
              <TableCell className="text-right">{t.pattaniTripCount}</TableCell>
              <TableCell className="text-right font-mono">
                {t.commissionThb.toFixed(2)}
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
                        await deleteThaiDriverTrip(t.id);
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

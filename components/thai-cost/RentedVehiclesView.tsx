"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteThaiRentedVehicleTrip,
  saveThaiRentedVehicleTrip,
  type ThaiRentedVehicleTripRow,
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

export function RentedVehiclesView({
  year,
  month,
  rows,
  canWrite,
}: {
  year: number;
  month: number;
  rows: ThaiRentedVehicleTripRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    station: "SONGKHLA" as "SONGKHLA" | "PATTANI",
    driverName: "",
    truckPlate: "",
    tripCost: "",
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        外部租车（如 BANHENG / SHS / YIN）：无底薪、无趟次提成，按趟录入租车费。
        计入宋卡/北大年真实成本，与公司司机成本分列。
      </p>
      <div className="flex flex-wrap gap-3">
        <Input
          type="number"
          className="w-24"
          value={year}
          onChange={(e) =>
            router.push(
              `/thai-cost/rented-vehicles?year=${Number(e.target.value) || year}&month=${month}`
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
              `/thai-cost/rented-vehicles?year=${year}&month=${Number(e.target.value) || month}`
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
          className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await saveThaiRentedVehicleTrip({
                  date: form.date,
                  station: form.station,
                  driverName: form.driverName,
                  truckPlate: form.truckPlate || null,
                  tripCost: Number(form.tripCost),
                });
                setForm((f) => ({ ...f, driverName: "", truckPlate: "", tripCost: "" }));
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
            value={form.station}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                station: e.target.value as "SONGKHLA" | "PATTANI",
              }))
            }
          >
            <option value="SONGKHLA">宋卡</option>
            <option value="PATTANI">北大年</option>
          </select>
          <Input
            placeholder="司机名 e.g. BANHENG"
            value={form.driverName}
            onChange={(e) =>
              setForm((f) => ({ ...f, driverName: e.target.value }))
            }
            required
          />
          <Input
            placeholder="车牌(可选)"
            value={form.truckPlate}
            onChange={(e) =>
              setForm((f) => ({ ...f, truckPlate: e.target.value }))
            }
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="租车费 THB"
            value={form.tripCost}
            onChange={(e) =>
              setForm((f) => ({ ...f, tripCost: e.target.value }))
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
            <TableHead>据点</TableHead>
            <TableHead>司机</TableHead>
            <TableHead>车牌</TableHead>
            <TableHead className="text-right">费用</TableHead>
            {canWrite && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canWrite ? 6 : 5} className="text-center text-haidee-muted">
                暂无租车记录
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatDisplay(r.date)}</TableCell>
                <TableCell>{r.station}</TableCell>
                <TableCell>{r.driverName}</TableCell>
                <TableCell>{r.truckPlate ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">
                  {r.tripCost.toFixed(2)}
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
                          await deleteThaiRentedVehicleTrip(r.id);
                          router.refresh();
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-haidee-red" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

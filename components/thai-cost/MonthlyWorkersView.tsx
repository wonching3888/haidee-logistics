"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteThaiMonthlyWorker,
  saveThaiMonthlyWorker,
  type ThaiMonthlyWorkerRow,
} from "@/app/actions/thai-cost";
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
import {
  DEFAULT_LUNCH_ALLOWANCE_THB,
  THAI_COST_STATION_LABELS,
  THAI_COST_STATIONS,
  type ThaiCostStation,
} from "@/lib/constants/thai-cost";

interface MonthlyWorkersViewProps {
  workers: ThaiMonthlyWorkerRow[];
  canWrite: boolean;
}

const emptyForm = {
  name: "",
  station: "SADAO" as ThaiCostStation,
  monthlyWage: "",
  lunchAllowance: String(DEFAULT_LUNCH_ALLOWANCE_THB),
  fuelAllowance: "0",
  rentRoomAllowance: "0",
  active: true,
};

function money(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function MonthlyWorkersView({
  workers,
  canWrite,
}: MonthlyWorkersViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | undefined>();
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  function openCreate() {
    setEditId(undefined);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(row: ThaiMonthlyWorkerRow) {
    setEditId(row.id);
    setForm({
      name: row.name,
      station: row.station,
      monthlyWage: String(row.monthlyWage),
      lunchAllowance: String(row.lunchAllowance),
      fuelAllowance: String(row.fuelAllowance),
      rentRoomAllowance: String(row.rentRoomAllowance),
      active: row.active,
    });
    setShowForm(true);
    setError(null);
  }

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setShowForm(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        月薪工人档案：工资 + LUNCH / FUEL / RENT ROOM 津贴（THB，按人固定，不随出勤天数打折）。
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {canWrite && (
        <div className="flex justify-end">
          <Button
            type="button"
            className="gap-2 bg-haidee-blue text-white"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            新增工人
          </Button>
        </div>
      )}

      {showForm && canWrite && (
        <form
          className="grid gap-3 rounded-lg border border-haidee-border bg-haidee-surface/50 p-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await saveThaiMonthlyWorker({
                id: editId,
                name: form.name,
                station: form.station,
                monthlyWage: Number(form.monthlyWage),
                lunchAllowance: Number(form.lunchAllowance),
                fuelAllowance: Number(form.fuelAllowance),
                rentRoomAllowance: Number(form.rentRoomAllowance),
                active: form.active,
              });
            });
          }}
        >
          <label className="space-y-1 text-sm">
            <span>姓名 Name</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>驻点 Station</span>
            <select
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={form.station}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  station: e.target.value as ThaiCostStation,
                }))
              }
            >
              {THAI_COST_STATIONS.map((s) => (
                <option key={s} value={s}>
                  {THAI_COST_STATION_LABELS[s].zh} {s}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>月薪 Wage</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.monthlyWage}
              onChange={(e) =>
                setForm((f) => ({ ...f, monthlyWage: e.target.value }))
              }
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>LUNCH</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.lunchAllowance}
              onChange={(e) =>
                setForm((f) => ({ ...f, lunchAllowance: e.target.value }))
              }
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>FUEL</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.fuelAllowance}
              onChange={(e) =>
                setForm((f) => ({ ...f, fuelAllowance: e.target.value }))
              }
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>RENT ROOM</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.rentRoomAllowance}
              onChange={(e) =>
                setForm((f) => ({ ...f, rentRoomAllowance: e.target.value }))
              }
              required
            />
          </label>
          <label className="flex items-end gap-2 pb-1 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
            />
            在职 Active
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-haidee-blue text-white"
            >
              {editId ? "保存" : "新增"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setShowForm(false)}
            >
              取消
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-haidee-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>姓名</TableHead>
              <TableHead>驻点</TableHead>
              <TableHead className="text-right">工资</TableHead>
              <TableHead className="text-right">LUNCH</TableHead>
              <TableHead className="text-right">FUEL</TableHead>
              <TableHead className="text-right">RENT ROOM</TableHead>
              <TableHead className="text-right">合计</TableHead>
              <TableHead>状态</TableHead>
              {canWrite && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 9 : 8}
                  className="py-8 text-center text-haidee-muted"
                >
                  暂无月薪工人
                </TableCell>
              </TableRow>
            ) : (
              workers.map((w) => {
                const total =
                  w.monthlyWage +
                  w.lunchAllowance +
                  w.fuelAllowance +
                  w.rentRoomAllowance;
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell>
                      {THAI_COST_STATION_LABELS[w.station].zh} ({w.station})
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(w.monthlyWage)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(w.lunchAllowance)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(w.fuelAllowance)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(w.rentRoomAllowance)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {money(total)}
                    </TableCell>
                    <TableCell>{w.active ? "在职" : "停用"}</TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(w)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            if (!confirm(`删除 ${w.name}？`)) return;
                            run(async () => {
                              await deleteThaiMonthlyWorker(w.id);
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-haidee-red" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteThaiPublicHoliday,
  saveThaiPublicHoliday,
  type ThaiPublicHolidayRow,
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
import { formatDisplay } from "@/lib/date-utils";

interface HolidaysViewProps {
  year: number;
  holidays: ThaiPublicHolidayRow[];
  canWrite: boolean;
}

export function HolidaysView({ year, holidays, canWrite }: HolidaysViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: `${year}-01-01`,
    name: "",
  });

  function openCreate() {
    setEditId(undefined);
    setForm({ date: `${year}-01-01`, name: "" });
    setShowForm(true);
    setError(null);
  }

  function openEdit(row: ThaiPublicHolidayRow) {
    setEditId(row.id);
    setForm({ date: row.date, name: row.name });
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
        泰国公众假期日历（手动维护）。星期日自动算假日费率，无需录入。假日费率 =
        星期日或本表中的日期。
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>年</span>
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) =>
              router.push(
                `/thai-cost/holidays?year=${Number(e.target.value) || year}`
              )
            }
          />
        </label>
        {canWrite && (
          <Button
            type="button"
            className="gap-2 bg-haidee-blue text-white"
            onClick={openCreate}
          >
            <Plus className="h-4 w-4" />
            新增假期
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {showForm && canWrite && (
        <form
          className="grid gap-3 rounded-lg border border-haidee-border bg-haidee-surface/50 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await saveThaiPublicHoliday({
                id: editId,
                date: form.date,
                name: form.name,
              });
            });
          }}
        >
          <label className="space-y-1 text-sm">
            <span>日期 Date</span>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>假期名称 Name</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="如：泼水节"
              required
            />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-haidee-blue text-white"
            >
              保存
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
              <TableHead>日期</TableHead>
              <TableHead>名称</TableHead>
              {canWrite && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 3 : 2}
                  className="py-8 text-center text-haidee-muted"
                >
                  该年暂无公众假期
                </TableCell>
              </TableRow>
            ) : (
              holidays.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>{formatDisplay(h.date)}</TableCell>
                  <TableCell className="font-medium">{h.name}</TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(h)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          if (!confirm(`删除 ${h.name}？`)) return;
                          run(async () => {
                            await deleteThaiPublicHoliday(h.id);
                          });
                        }}
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
    </div>
  );
}

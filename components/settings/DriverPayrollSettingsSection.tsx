"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteDriverPayrollMaster,
  saveDriverPayrollMaster,
} from "@/app/actions/driver-payroll";
import {
  DriverFormDialog,
  driverToFormValue,
  parseDriverFormValue,
  type DriverFormValue,
} from "@/components/settings/DriverFormDialog";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { Badge } from "@/components/ui/badge";

interface DriverRow {
  id: string;
  name: string;
  fullName: string | null;
  active: boolean;
  baseSalary: number | null;
  autoCountEmployeeCode: string | null;
  icNumber: string | null;
  epfNumber: string | null;
  socsoNumber: string | null;
  maritalStatus: string | null;
  childCount: number;
}

interface DriverPayrollSettingsSectionProps {
  drivers: DriverRow[];
}

export function DriverPayrollSettingsSection({
  drivers,
}: DriverPayrollSettingsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [formValue, setFormValue] = useState<DriverFormValue | undefined>();

  function runAction(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setDialogOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        维护马来西亚司机薪资主数据。路线津贴请前往「薪资设定 Payroll
        Settings」。月薪计算请前往「司机薪资 Driver Payroll」。
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          className="gap-2 bg-haidee-blue text-white"
          onClick={() => {
            setEditId(undefined);
            setFormValue(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          新增司机
        </Button>
      </div>

      <ScrollMatrixTable heightOffset={320}>
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>小名 Nickname</TableHead>
              <TableHead>全名 Full Name</TableHead>
              <TableHead>AutoCount</TableHead>
              <TableHead className="text-right">底薪</TableHead>
              <TableHead>婚姻/子女</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-haidee-muted">
                  暂无司机 No drivers
                </TableCell>
              </TableRow>
            ) : (
              drivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="font-medium">{driver.name}</TableCell>
                  <TableCell>{driver.fullName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {driver.autoCountEmployeeCode ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {driver.baseSalary?.toFixed(2) ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {driver.maritalStatus ?? "—"} / {driver.childCount}
                  </TableCell>
                  <TableCell>
                    <Badge variant={driver.active ? "default" : "secondary"}>
                      {driver.active ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          setEditId(driver.id);
                          setFormValue(driverToFormValue(driver));
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending || !driver.active}
                        onClick={() =>
                          runAction(async () => deleteDriverPayrollMaster(driver.id))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-haidee-red" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollMatrixTable>

      <DriverFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editId ? "编辑司机 Edit Driver" : "新增司机 New Driver"}
        initialValue={formValue}
        isPending={isPending}
        onSave={(form) =>
          runAction(async () =>
            saveDriverPayrollMaster({
              id: editId,
              ...parseDriverFormValue(form),
            })
          )
        }
      />
    </div>
  );
}

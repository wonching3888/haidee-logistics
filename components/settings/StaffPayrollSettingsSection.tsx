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
  deleteStaffPayrollMaster,
  saveStaffPayrollMaster,
} from "@/app/actions/staff-payroll";
import {
  StaffFormDialog,
  staffToFormValue,
  parseStaffFormValue,
  type StaffFormValue,
} from "@/components/settings/StaffFormDialog";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { Badge } from "@/components/ui/badge";

interface StaffRow {
  id: string;
  name: string;
  nickname: string | null;
  fullName: string | null;
  active: boolean;
  terminationDate: string | null;
  startDate: string | null;
  baseSalary: number | null;
  autoCountEmployeeCode: string | null;
  icNumber: string | null;
  epfNumber: string | null;
  socsoNumber: string | null;
  bankName: string | null;
  bankAccount: string | null;
  maritalStatus: string | null;
  spouseWorking: boolean | null;
  pcbNeedsReview: boolean;
  childCount: number;
  accountCodeSuffix: string | null;
  isSocsoSecondCategory: boolean;
  lindung24JamOptOut: boolean;
  payrollCategory: string;
  tinNumber: string | null;
  phoneNumber: string | null;
}

function spouseWorkingLabel(staff: StaffRow) {
  if (staff.maritalStatus !== "married") return "—";
  if (staff.spouseWorking === true) return "是";
  if (staff.spouseWorking === false) return "否";
  return "待填";
}

function payrollCategoryLabel(value: string) {
  return value === "director_remuneration" ? "董事袍金" : "薪金";
}

interface StaffPayrollSettingsSectionProps {
  staff: StaffRow[];
}

export function StaffPayrollSettingsSection({
  staff,
}: StaffPayrollSettingsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [formValue, setFormValue] = useState<StaffFormValue | undefined>();

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
        维护 WTL Express 员工薪资主数据（身份/银行/法定登记）。底薪与婚姻资料可由会计在此补齐。月薪计算请前往「员工工资单 Staff Payroll」。
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
          新增员工
        </Button>
      </div>

      <ScrollMatrixTable heightOffset={320}>
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>姓名 Name</TableHead>
              <TableHead>昵称</TableHead>
              <TableHead>类别</TableHead>
              <TableHead>科目后缀</TableHead>
              <TableHead className="text-right">底薪</TableHead>
              <TableHead>婚姻/子女</TableHead>
              <TableHead>配偶工作</TableHead>
              <TableHead>PCB资料</TableHead>
              <TableHead>入职</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="py-8 text-center text-haidee-muted"
                >
                  暂无员工 No staff
                </TableCell>
              </TableRow>
            ) : (
              staff.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.nickname ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {payrollCategoryLabel(row.payrollCategory)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.accountCodeSuffix ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.baseSalary?.toFixed(2) ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.maritalStatus ?? "—"} / {row.childCount}
                  </TableCell>
                  <TableCell className="text-sm">
                    {spouseWorkingLabel(row)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.pcbNeedsReview ? "secondary" : "default"}
                    >
                      {row.pcbNeedsReview ? "待补" : "齐全"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {row.startDate ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.active ? "default" : "secondary"}>
                      {row.active ? "启用" : "停用"}
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
                          setEditId(row.id);
                          setFormValue(staffToFormValue(row));
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending || !row.active}
                        onClick={() =>
                          runAction(async () =>
                            deleteStaffPayrollMaster(row.id)
                          )
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

      <StaffFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editId ? "编辑员工 Edit Staff" : "新增员工 New Staff"}
        initialValue={formValue}
        isPending={isPending}
        onSave={(form) =>
          runAction(async () =>
            saveStaffPayrollMaster({
              id: editId,
              ...parseStaffFormValue(form),
            })
          )
        }
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MARITAL_STATUSES } from "@/lib/constants/payroll";

export interface DriverFormValue {
  name: string;
  active: boolean;
  baseSalary: string;
  allowance1Market: string;
  allowance2Markets: string;
  allowance3Markets: string;
  bigTruckCrateCommission: string;
  smallTruckCrateCommission: string;
  autoCountEmployeeCode: string;
  icNumber: string;
  epfNumber: string;
  socsoNumber: string;
  maritalStatus: string;
  childCount: string;
}

const EMPTY_FORM: DriverFormValue = {
  name: "",
  active: true,
  baseSalary: "",
  allowance1Market: "",
  allowance2Markets: "",
  allowance3Markets: "",
  bigTruckCrateCommission: "",
  smallTruckCrateCommission: "",
  autoCountEmployeeCode: "",
  icNumber: "",
  epfNumber: "",
  socsoNumber: "",
  maritalStatus: "",
  childCount: "0",
};

interface DriverFormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initialValue?: DriverFormValue;
  onSave: (value: DriverFormValue) => void;
  isPending: boolean;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function DriverFormDialog({
  open,
  onClose,
  title,
  initialValue,
  onSave,
  isPending,
}: DriverFormDialogProps) {
  const [form, setForm] = useState<DriverFormValue>(EMPTY_FORM);

  useEffect(() => {
    setForm(initialValue ?? EMPTY_FORM);
  }, [initialValue, open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            姓名 Name
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="min-h-[44px]"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              底薪 Base Salary (MYR)
              <Input
                value={form.baseSalary}
                onChange={(e) =>
                  setForm({ ...form, baseSalary: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              AutoCount 员工编号
              <Input
                value={form.autoCountEmployeeCode}
                onChange={(e) =>
                  setForm({ ...form, autoCountEmployeeCode: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1 text-sm">
              1市场津贴
              <Input
                value={form.allowance1Market}
                onChange={(e) =>
                  setForm({ ...form, allowance1Market: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              2市场津贴
              <Input
                value={form.allowance2Markets}
                onChange={(e) =>
                  setForm({ ...form, allowance2Markets: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              3市场津贴
              <Input
                value={form.allowance3Markets}
                onChange={(e) =>
                  setForm({ ...form, allowance3Markets: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              大车回桶提成/趟
              <Input
                value={form.bigTruckCrateCommission}
                onChange={(e) =>
                  setForm({ ...form, bigTruckCrateCommission: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              小车回桶提成/趟
              <Input
                value={form.smallTruckCrateCommission}
                onChange={(e) =>
                  setForm({ ...form, smallTruckCrateCommission: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              身份证号码 IC
              <Input
                value={form.icNumber}
                onChange={(e) => setForm({ ...form, icNumber: e.target.value })}
                className="min-h-[44px] font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              EPF 号码
              <Input
                value={form.epfNumber}
                onChange={(e) => setForm({ ...form, epfNumber: e.target.value })}
                className="min-h-[44px] font-mono"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              SOCSO 号码
              <Input
                value={form.socsoNumber}
                onChange={(e) =>
                  setForm({ ...form, socsoNumber: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
            <label className="block space-y-1 text-sm">
              子女人数 Children
              <Input
                value={form.childCount}
                onChange={(e) =>
                  setForm({ ...form, childCount: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            婚姻状况 Marital Status
            <select
              value={form.maritalStatus}
              onChange={(e) =>
                setForm({ ...form, maritalStatus: e.target.value })
              }
              className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
            >
              <option value="">—</option>
              {MARITAL_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            启用 Active
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            className="bg-haidee-blue text-white"
            disabled={isPending}
            onClick={() => onSave(form)}
          >
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function driverToFormValue(driver: {
  name: string;
  active: boolean;
  baseSalary: number | null;
  allowance1Market: number | null;
  allowance2Markets: number | null;
  allowance3Markets: number | null;
  bigTruckCrateCommission: number | null;
  smallTruckCrateCommission: number | null;
  autoCountEmployeeCode: string | null;
  icNumber: string | null;
  epfNumber: string | null;
  socsoNumber: string | null;
  maritalStatus: string | null;
  childCount: number;
}): DriverFormValue {
  const num = (value: number | null) =>
    value != null ? String(value) : "";
  return {
    name: driver.name,
    active: driver.active,
    baseSalary: num(driver.baseSalary),
    allowance1Market: num(driver.allowance1Market),
    allowance2Markets: num(driver.allowance2Markets),
    allowance3Markets: num(driver.allowance3Markets),
    bigTruckCrateCommission: num(driver.bigTruckCrateCommission),
    smallTruckCrateCommission: num(driver.smallTruckCrateCommission),
    autoCountEmployeeCode: driver.autoCountEmployeeCode ?? "",
    icNumber: driver.icNumber ?? "",
    epfNumber: driver.epfNumber ?? "",
    socsoNumber: driver.socsoNumber ?? "",
    maritalStatus: driver.maritalStatus ?? "",
    childCount: String(driver.childCount),
  };
}

export function parseDriverFormValue(form: DriverFormValue) {
  return {
    name: form.name,
    active: form.active,
    baseSalary: optionalNumber(form.baseSalary),
    allowance1Market: optionalNumber(form.allowance1Market),
    allowance2Markets: optionalNumber(form.allowance2Markets),
    allowance3Markets: optionalNumber(form.allowance3Markets),
    bigTruckCrateCommission: optionalNumber(form.bigTruckCrateCommission),
    smallTruckCrateCommission: optionalNumber(form.smallTruckCrateCommission),
    autoCountEmployeeCode: form.autoCountEmployeeCode,
    icNumber: form.icNumber,
    epfNumber: form.epfNumber,
    socsoNumber: form.socsoNumber,
    maritalStatus: form.maritalStatus,
    childCount: Number(form.childCount) || 0,
  };
}

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

/** Form encoding: "" = unset, "true" / "false" = boolean. */
export type SpouseWorkingFormValue = "" | "true" | "false";

export type StaffPayrollCategoryFormValue =
  | "salary"
  | "director_remuneration";

export interface StaffFormValue {
  name: string;
  nickname: string;
  fullName: string;
  active: boolean;
  terminationDate: string;
  startDate: string;
  baseSalary: string;
  autoCountEmployeeCode: string;
  icNumber: string;
  epfNumber: string;
  socsoNumber: string;
  bankName: string;
  bankAccount: string;
  maritalStatus: string;
  spouseWorking: SpouseWorkingFormValue;
  childCount: string;
  accountCodeSuffix: string;
  isSocsoSecondCategory: boolean;
  lindung24JamOptOut: boolean;
  payrollCategory: StaffPayrollCategoryFormValue;
  tinNumber: string;
  phoneNumber: string;
}

const EMPTY_FORM: StaffFormValue = {
  name: "",
  nickname: "",
  fullName: "",
  active: true,
  terminationDate: "",
  startDate: "",
  baseSalary: "",
  autoCountEmployeeCode: "",
  icNumber: "",
  epfNumber: "",
  socsoNumber: "",
  bankName: "",
  bankAccount: "",
  maritalStatus: "",
  spouseWorking: "",
  childCount: "0",
  accountCodeSuffix: "",
  isSocsoSecondCategory: false,
  lindung24JamOptOut: false,
  payrollCategory: "salary",
  tinNumber: "",
  phoneNumber: "",
};

interface StaffFormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initialValue?: StaffFormValue;
  onSave: (value: StaffFormValue) => void;
  isPending: boolean;
}

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function spouseWorkingToForm(
  value: boolean | null | undefined
): SpouseWorkingFormValue {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

function spouseWorkingFromForm(
  value: SpouseWorkingFormValue
): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function StaffFormDialog({
  open,
  onClose,
  title,
  initialValue,
  onSave,
  isPending,
}: StaffFormDialogProps) {
  const [form, setForm] = useState<StaffFormValue>(EMPTY_FORM);

  useEffect(() => {
    setForm(initialValue ?? EMPTY_FORM);
  }, [initialValue, open]);

  const isMarried = form.maritalStatus === "married";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            姓名 Name（唯一）
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="min-h-[44px]"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              昵称 Nickname
              <Input
                value={form.nickname}
                onChange={(e) =>
                  setForm({ ...form, nickname: e.target.value })
                }
                className="min-h-[44px]"
              />
            </label>
            <label className="block space-y-1 text-sm">
              全名 Full Name（可选）
              <Input
                value={form.fullName}
                onChange={(e) =>
                  setForm({ ...form, fullName: e.target.value })
                }
                className="min-h-[44px]"
              />
            </label>
          </div>
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
              薪资类别 Payroll category
              <select
                value={form.payrollCategory}
                onChange={(e) =>
                  setForm({
                    ...form,
                    payrollCategory: e.target
                      .value as StaffPayrollCategoryFormValue,
                  })
                }
                className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
              >
                <option value="salary">薪金 Salary</option>
                <option value="director_remuneration">
                  董事袍金 Director&apos;s Remuneration
                </option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
            <label className="block space-y-1 text-sm">
              科目后缀 JV Suffix
              <Input
                value={form.accountCodeSuffix}
                onChange={(e) =>
                  setForm({ ...form, accountCodeSuffix: e.target.value })
                }
                placeholder="如 CHEW"
                className="min-h-[44px] font-mono uppercase"
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
              税务编号 TIN
              <Input
                value={form.tinNumber}
                onChange={(e) =>
                  setForm({ ...form, tinNumber: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              EPF 号码
              <Input
                value={form.epfNumber}
                onChange={(e) => setForm({ ...form, epfNumber: e.target.value })}
                className="min-h-[44px] font-mono"
              />
            </label>
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
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              银行 Bank
              <Input
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                className="min-h-[44px]"
              />
            </label>
            <label className="block space-y-1 text-sm">
              银行账号 Bank account
              <Input
                value={form.bankAccount}
                onChange={(e) =>
                  setForm({ ...form, bankAccount: e.target.value })
                }
                className="min-h-[44px] font-mono"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              电话 Phone
              <Input
                value={form.phoneNumber}
                onChange={(e) =>
                  setForm({ ...form, phoneNumber: e.target.value })
                }
                className="min-h-[44px]"
              />
            </label>
            <label className="block space-y-1 text-sm">
              入职日期 Start date
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              婚姻状况 Marital Status
              <select
                value={form.maritalStatus}
                onChange={(e) => {
                  const maritalStatus = e.target.value;
                  setForm({
                    ...form,
                    maritalStatus,
                    spouseWorking:
                      maritalStatus === "married" ? form.spouseWorking : "",
                  });
                }}
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
            {isMarried ? (
              <label className="block space-y-1 text-sm">
                配偶是否工作 Spouse working
                <select
                  value={form.spouseWorking}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      spouseWorking: e.target.value as SpouseWorkingFormValue,
                    })
                  }
                  className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
                >
                  <option value="">— 待填</option>
                  <option value="true">是 Yes（配偶有工作）</option>
                  <option value="false">否 No（配偶无工作）</option>
                </select>
              </label>
            ) : (
              <div className="self-end pb-3 text-sm text-haidee-muted">
                单身无需填写配偶工作状态
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
            <label className="block space-y-1 text-sm">
              离职日期 Termination date（可选）
              <Input
                type="date"
                value={form.terminationDate}
                onChange={(e) =>
                  setForm({ ...form, terminationDate: e.target.value })
                }
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isSocsoSecondCategory}
              onChange={(e) =>
                setForm({ ...form, isSocsoSecondCategory: e.target.checked })
              }
            />
            SOCSO 第二类 Second Category（默认关；员工通常不用）
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.lindung24JamOptOut}
              onChange={(e) =>
                setForm({ ...form, lindung24JamOptOut: e.target.checked })
              }
            />
            退出 Lindung 24 Jam（自愿 Opt-out）
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

export function staffToFormValue(staff: {
  name: string;
  nickname: string | null;
  fullName: string | null;
  active: boolean;
  terminationDate?: string | null;
  startDate?: string | null;
  baseSalary: number | null;
  autoCountEmployeeCode: string | null;
  icNumber: string | null;
  epfNumber: string | null;
  socsoNumber: string | null;
  bankName: string | null;
  bankAccount: string | null;
  maritalStatus: string | null;
  spouseWorking?: boolean | null;
  childCount: number;
  accountCodeSuffix?: string | null;
  isSocsoSecondCategory?: boolean;
  lindung24JamOptOut?: boolean;
  payrollCategory?: string;
  tinNumber?: string | null;
  phoneNumber?: string | null;
}): StaffFormValue {
  const num = (value: number | null) => (value != null ? String(value) : "");
  const category: StaffPayrollCategoryFormValue =
    staff.payrollCategory === "director_remuneration"
      ? "director_remuneration"
      : "salary";
  return {
    name: staff.name,
    nickname: staff.nickname ?? "",
    fullName: staff.fullName ?? "",
    active: staff.active,
    terminationDate: staff.terminationDate ?? "",
    startDate: staff.startDate ?? "",
    baseSalary: num(staff.baseSalary),
    autoCountEmployeeCode: staff.autoCountEmployeeCode ?? "",
    icNumber: staff.icNumber ?? "",
    epfNumber: staff.epfNumber ?? "",
    socsoNumber: staff.socsoNumber ?? "",
    bankName: staff.bankName ?? "",
    bankAccount: staff.bankAccount ?? "",
    maritalStatus: staff.maritalStatus ?? "",
    spouseWorking: spouseWorkingToForm(staff.spouseWorking),
    childCount: String(staff.childCount),
    accountCodeSuffix: staff.accountCodeSuffix ?? "",
    isSocsoSecondCategory: Boolean(staff.isSocsoSecondCategory),
    lindung24JamOptOut: Boolean(staff.lindung24JamOptOut),
    payrollCategory: category,
    tinNumber: staff.tinNumber ?? "",
    phoneNumber: staff.phoneNumber ?? "",
  };
}

export function parseStaffFormValue(form: StaffFormValue) {
  return {
    name: form.name,
    nickname: form.nickname.trim() || null,
    fullName: form.fullName.trim() || null,
    active: form.active,
    terminationDate: form.terminationDate.trim() || null,
    startDate: form.startDate.trim() || null,
    baseSalary: optionalNumber(form.baseSalary),
    autoCountEmployeeCode: form.autoCountEmployeeCode,
    icNumber: form.icNumber,
    epfNumber: form.epfNumber,
    socsoNumber: form.socsoNumber,
    bankName: form.bankName,
    bankAccount: form.bankAccount,
    maritalStatus: form.maritalStatus,
    spouseWorking: spouseWorkingFromForm(form.spouseWorking),
    childCount: Number(form.childCount) || 0,
    accountCodeSuffix: form.accountCodeSuffix.trim() || null,
    isSocsoSecondCategory: form.isSocsoSecondCategory,
    lindung24JamOptOut: form.lindung24JamOptOut,
    payrollCategory: form.payrollCategory,
    tinNumber: form.tinNumber,
    phoneNumber: form.phoneNumber,
  };
}

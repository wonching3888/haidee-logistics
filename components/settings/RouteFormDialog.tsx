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
import { DISPATCH_MARKET_ORDER } from "@/lib/markets";
import { getMarketDisplayName } from "@/lib/constants/market-names";

export interface RouteFormValue {
  code: string;
  name: string;
  markets: string[];
  sadooMileageKm: string;
  tollFee: string;
  tollFeeClass2: string;
  tollFeeClass3: string;
  fishCheckingFee: string;
  parkingFee: string;
  displayOrder: string;
  active: boolean;
}

export interface RouteMasterRow {
  id: string;
  code: string;
  name: string;
  markets: string[];
  sadooMileageKm: number | null;
  tollFee: number | null;
  tollFeeClass2: number | null;
  tollFeeClass3: number | null;
  fishCheckingFee: number | null;
  kpbFee: number | null;
  parkingFee: number | null;
  displayOrder: number | null;
  active: boolean;
}

function optionalNumberString(value: number | null | undefined) {
  return value != null ? String(value) : "";
}

export function routeToFormValue(route?: RouteMasterRow): RouteFormValue {
  return {
    code: route?.code ?? "",
    name: route?.name ?? "",
    markets: route?.markets ?? [],
    sadooMileageKm: optionalNumberString(route?.sadooMileageKm),
    tollFee: optionalNumberString(route?.tollFee),
    tollFeeClass2: optionalNumberString(route?.tollFeeClass2),
    tollFeeClass3: optionalNumberString(route?.tollFeeClass3),
    fishCheckingFee: optionalNumberString(route?.fishCheckingFee),
    parkingFee: optionalNumberString(route?.parkingFee),
    displayOrder:
      route?.displayOrder != null ? String(route.displayOrder) : "",
    active: route?.active ?? true,
  };
}

function parseOptionalNumberInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} 不能为负数`);
  }
  return parsed;
}

export function parseRouteFormValue(value: RouteFormValue) {
  const displayOrderTrimmed = value.displayOrder.trim();
  let displayOrder: number | null = null;
  if (displayOrderTrimmed) {
    const parsed = Number(displayOrderTrimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error("排序必须为非负整数");
    }
    displayOrder = parsed;
  }

  return {
    code: value.code.trim().toUpperCase(),
    name: value.name.trim(),
    markets: value.markets,
    sadooMileageKm: parseOptionalNumberInput(value.sadooMileageKm, "里程"),
    tollFee: parseOptionalNumberInput(value.tollFee, "过路费/大道费"),
    tollFeeClass2: parseOptionalNumberInput(value.tollFeeClass2, "CLASS2过路费"),
    tollFeeClass3: parseOptionalNumberInput(value.tollFeeClass3, "CLASS3过路费"),
    fishCheckingFee: parseOptionalNumberInput(
      value.fishCheckingFee,
      "Fish Checking Fee"
    ),
    parkingFee: parseOptionalNumberInput(value.parkingFee, "Parking Fee"),
    displayOrder,
    active: value.active,
  };
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-haidee-text">{label}</label>
      {children}
    </div>
  );
}

interface RouteFormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  initialValue?: RouteFormValue;
  isEdit: boolean;
  onSave: (value: RouteFormValue) => void;
  isPending: boolean;
}

export function RouteFormDialog({
  open,
  onClose,
  title,
  initialValue,
  isEdit,
  onSave,
  isPending,
}: RouteFormDialogProps) {
  const [form, setForm] = useState<RouteFormValue>(() =>
    initialValue ?? routeToFormValue()
  );

  useEffect(() => {
    if (open) {
      setForm(initialValue ?? routeToFormValue());
    }
  }, [open, initialValue]);

  function toggleMarket(code: string) {
    setForm((prev) => ({
      ...prev,
      markets: prev.markets.includes(code)
        ? prev.markets.filter((item) => item !== code)
        : [...prev.markets, code],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="路线代码 Route Code">
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                disabled={isEdit}
                placeholder="如 KL、MC"
                className="min-h-[44px] font-mono"
              />
            </FormField>
            <FormField label="路线名称 Route Name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如 KL路线"
                className="min-h-[44px]"
              />
            </FormField>
          </div>

          <FormField label="包含市场 Markets">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-haidee-border p-3 sm:grid-cols-3">
              {DISPATCH_MARKET_ORDER.map((code) => (
                <label
                  key={code}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-haidee-surface"
                >
                  <input
                    type="checkbox"
                    checked={form.markets.includes(code)}
                    onChange={() => toggleMarket(code)}
                  />
                  <span className="font-mono">{code}</span>
                  <span className="text-xs text-haidee-muted">
                    {getMarketDisplayName(code)}
                  </span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="里程 (km)">
              <Input
                value={form.sadooMileageKm}
                onChange={(e) =>
                  setForm({ ...form, sadooMileageKm: e.target.value })
                }
                placeholder="0"
                className="min-h-[44px] font-mono"
              />
            </FormField>
            <FormField label="排序 Display Order">
              <Input
                value={form.displayOrder}
                onChange={(e) =>
                  setForm({ ...form, displayOrder: e.target.value })
                }
                placeholder="1"
                className="min-h-[44px] font-mono"
              />
            </FormField>
          </div>

          <div className="rounded-lg border border-haidee-border bg-haidee-surface/40 p-3">
            <p className="mb-3 text-sm font-medium text-haidee-text">
              路线费用 Route Fees (MYR)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="过路费(兼容旧字段) Toll Legacy">
                <Input
                  value={form.tollFee}
                  onChange={(e) => setForm({ ...form, tollFee: e.target.value })}
                  className="min-h-[44px] font-mono"
                />
              </FormField>
              <FormField label="过路费 CLASS2">
                <Input
                  value={form.tollFeeClass2}
                  onChange={(e) =>
                    setForm({ ...form, tollFeeClass2: e.target.value })
                  }
                  className="min-h-[44px] font-mono"
                />
              </FormField>
              <FormField label="过路费 CLASS3">
                <Input
                  value={form.tollFeeClass3}
                  onChange={(e) =>
                    setForm({ ...form, tollFeeClass3: e.target.value })
                  }
                  className="min-h-[44px] font-mono"
                />
              </FormField>
              <FormField label="Fish Checking Fee">
                <Input
                  value={form.fishCheckingFee}
                  onChange={(e) =>
                    setForm({ ...form, fishCheckingFee: e.target.value })
                  }
                  className="min-h-[44px] font-mono"
                />
              </FormField>
              <FormField label="Parking Fee">
                <Input
                  value={form.parkingFee}
                  onChange={(e) =>
                    setForm({ ...form, parkingFee: e.target.value })
                  }
                  className="min-h-[44px] font-mono"
                />
              </FormField>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            启用 Active
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            取消 Cancel
          </Button>
          <Button
            className="bg-haidee-blue text-white"
            onClick={() => onSave(form)}
            disabled={isPending}
          >
            保存 Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return value.toFixed(2);
}

export function formatRouteFeeTotal(route: RouteMasterRow) {
  const total =
    (route.tollFeeClass3 ?? route.tollFee ?? 0) +
    (route.fishCheckingFee ?? 0) +
    (route.parkingFee ?? 0);
  return total > 0 ? total.toFixed(2) : "—";
}

export function formatRouteMarkets(markets: string[]) {
  return markets.join(" / ") || "—";
}

export { formatMoney };

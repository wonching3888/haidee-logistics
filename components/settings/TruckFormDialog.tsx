"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  defaultCostItemsForCountry,
  fuelPriceForCountry,
  getTruckCountryMeta,
  type TruckCountry,
} from "@/lib/constants/truck-cost";
import {
  calcCostPerKm,
  calcFuelCostPerKm,
  calcTotalCostPerKm,
  formatTruckMoney,
} from "@/lib/truck-cost";

interface DriverOption {
  id: string;
  name: string;
}

interface TruckCostItemInput {
  id?: string;
  name: string;
  annualAmount: number;
}

export interface TruckFormValue {
  plate: string;
  type: string;
  country: TruckCountry;
  capacityTong?: number;
  defaultDriverId?: string | null;
  sortOrder?: number | null;
  fuelEfficiencyKmPerL?: number | null;
  annualMileageKm?: number | null;
  costItems: { name: string; annualAmount: number }[];
  active: boolean;
}

interface TruckFormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  drivers: DriverOption[];
  fuelPrice: { myrPerLiter: number; thbPerLiter: number };
  initialValue?: TruckFormValue;
  onSave: (value: TruckFormValue) => void;
  isPending: boolean;
}

interface CostItemRow {
  clientId: string;
  name: string;
  annualAmount: string;
}

function newCostItemRow(name = "", annualAmount = ""): CostItemRow {
  return {
    clientId: crypto.randomUUID(),
    name,
    annualAmount,
  };
}

function rowsFromItems(items: TruckCostItemInput[]) {
  return items.map((item) =>
    newCostItemRow(item.name, item.annualAmount ? String(item.annualAmount) : "")
  );
}

function defaultTruckForm(country: TruckCountry = "MY"): TruckFormValue {
  return {
    plate: "",
    type: "big",
    country,
    capacityTong: undefined,
    defaultDriverId: null,
    sortOrder: null,
    fuelEfficiencyKmPerL: null,
    annualMileageKm: null,
    costItems: defaultCostItemsForCountry(country),
    active: true,
  };
}

export function TruckFormDialog({
  open,
  onClose,
  title,
  drivers,
  fuelPrice,
  initialValue,
  onSave,
  isPending,
}: TruckFormDialogProps) {
  const [plate, setPlate] = useState("");
  const [type, setType] = useState("big");
  const [country, setCountry] = useState<TruckCountry>("MY");
  const [capacityTong, setCapacityTong] = useState("");
  const [defaultDriverId, setDefaultDriverId] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [fuelEfficiencyKmPerL, setFuelEfficiencyKmPerL] = useState("");
  const [annualMileageKm, setAnnualMileageKm] = useState("");
  const [active, setActive] = useState(true);
  const [costItems, setCostItems] = useState<CostItemRow[]>([]);

  useEffect(() => {
    if (!open) return;
    const value = initialValue ?? defaultTruckForm("MY");
    setPlate(value.plate);
    setType(value.type);
    setCountry(value.country);
    setCapacityTong(value.capacityTong?.toString() ?? "");
    setDefaultDriverId(value.defaultDriverId ?? "");
    setSortOrder(value.sortOrder?.toString() ?? "");
    setFuelEfficiencyKmPerL(
      value.fuelEfficiencyKmPerL != null
        ? String(value.fuelEfficiencyKmPerL)
        : ""
    );
    setAnnualMileageKm(
      value.annualMileageKm != null ? String(value.annualMileageKm) : ""
    );
    setActive(value.active);
    setCostItems(
      rowsFromItems(
        value.costItems.length > 0
          ? value.costItems
          : defaultCostItemsForCountry(value.country)
      )
    );
  }, [open, initialValue]);

  const countryMeta = getTruckCountryMeta(country);
  const currentFuelPrice = fuelPriceForCountry(country, fuelPrice);
  const parsedAnnualMileage = annualMileageKm
    ? parseInt(annualMileageKm, 10)
    : null;
  const parsedFuelEfficiency = fuelEfficiencyKmPerL
    ? Number(fuelEfficiencyKmPerL)
    : null;

  const parsedCostItems = useMemo(
    () =>
      costItems.map((item) => ({
        name: item.name.trim(),
        annualAmount: item.annualAmount ? Number(item.annualAmount) : 0,
      })),
    [costItems]
  );

  const totalCostPerKm = calcTotalCostPerKm(parsedCostItems, parsedAnnualMileage);
  const fuelCostPerKm = calcFuelCostPerKm(
    currentFuelPrice,
    parsedFuelEfficiency
  );

  function handleCountryChange(nextCountry: TruckCountry) {
    setCountry(nextCountry);
    setCostItems(rowsFromItems(defaultCostItemsForCountry(nextCountry)));
  }

  function handleSave() {
    onSave({
      plate,
      type,
      country,
      capacityTong: capacityTong ? parseInt(capacityTong, 10) : undefined,
      defaultDriverId: defaultDriverId || null,
      sortOrder: sortOrder ? parseInt(sortOrder, 10) : null,
      fuelEfficiencyKmPerL: fuelEfficiencyKmPerL
        ? Number(fuelEfficiencyKmPerL)
        : null,
      annualMileageKm: parsedAnnualMileage,
      costItems: parsedCostItems.filter((item) => item.name),
      active,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="车牌 Plate">
              <Input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className="min-h-[44px] font-mono"
              />
            </FormField>
            <FormField label="国家 Country">
              <select
                value={country}
                onChange={(e) =>
                  handleCountryChange(e.target.value as TruckCountry)
                }
                className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
              >
                <option value="MY">马来西亚 Malaysia (MYR)</option>
                <option value="TH">泰国 Thailand (THB)</option>
              </select>
            </FormField>
            <FormField label="类型 Type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
              >
                <option value="big">大车 Big</option>
                <option value="small">小车 Small</option>
              </select>
            </FormField>
            <FormField label="容量 Capacity (crates)">
              <Input
                type="number"
                inputMode="numeric"
                value={capacityTong}
                onChange={(e) => setCapacityTong(e.target.value)}
                className="min-h-[44px] font-mono"
              />
            </FormField>
            <FormField label="默认司机 Default Driver">
              <select
                value={defaultDriverId}
                onChange={(e) => setDefaultDriverId(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
              >
                <option value="">— 无 None —</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="排序 Sort Order">
              <Input
                type="number"
                inputMode="numeric"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="min-h-[44px] font-mono"
              />
            </FormField>
          </div>

          <div className="rounded-lg border border-haidee-border bg-haidee-surface/40 p-4">
            <h4 className="mb-3 text-sm font-semibold text-haidee-text">
              运营成本 Operating Cost
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="油耗 Fuel Efficiency (KM/L)">
                <Input
                  value={fuelEfficiencyKmPerL}
                  onChange={(e) => setFuelEfficiencyKmPerL(e.target.value)}
                  className="min-h-[44px] font-mono"
                  placeholder="例 3.5"
                />
              </FormField>
              <FormField label="年总里程 Annual Mileage (km)">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={annualMileageKm}
                  onChange={(e) => setAnnualMileageKm(e.target.value)}
                  className="min-h-[44px] font-mono"
                />
              </FormField>
              <FormField
                label={`当前油价 Current Fuel Price (${countryMeta.currency}/L)`}
              >
                <Input
                  value={currentFuelPrice.toFixed(4)}
                  readOnly
                  className="min-h-[44px] bg-white font-mono"
                />
              </FormField>
            </div>
            <p className="mt-2 text-xs text-haidee-muted">
              油价在「汇率设定 Exchange Rate」页面统一维护。参考油耗成本：
              {formatTruckMoney(fuelCostPerKm, countryMeta.currency)}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-haidee-text">
                成本项目 Cost Items ({countryMeta.currency})
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() =>
                  setCostItems((prev) => [...prev, newCostItemRow()])
                }
              >
                <Plus className="h-4 w-4" />
                新增项目
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-haidee-border">
              <table className="min-w-full text-sm">
                <thead className="bg-haidee-surface text-left text-haidee-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">项目名称 Item</th>
                    <th className="px-3 py-2 font-medium text-right">
                      年度总额 Annual
                    </th>
                    <th className="px-3 py-2 font-medium text-right">/km</th>
                    <th className="w-12 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {costItems.map((item, index) => {
                    const annualAmount = item.annualAmount
                      ? Number(item.annualAmount)
                      : 0;
                    const perKm = calcCostPerKm(
                      annualAmount,
                      parsedAnnualMileage
                    );

                    return (
                      <tr
                        key={item.clientId}
                        className="border-t border-haidee-border"
                      >
                        <td className="px-3 py-2">
                          <Input
                            value={item.name}
                            onChange={(e) =>
                              setCostItems((prev) =>
                                prev.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, name: e.target.value }
                                    : row
                                )
                              )
                            }
                            className="min-h-[40px]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={item.annualAmount}
                            onChange={(e) =>
                              setCostItems((prev) =>
                                prev.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, annualAmount: e.target.value }
                                    : row
                                )
                              )
                            }
                            className="min-h-[40px] text-right font-mono"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-haidee-text">
                          {perKm != null ? perKm.toFixed(4) : "—"}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCostItems((prev) =>
                                prev.filter((_, rowIndex) => rowIndex !== index)
                              )
                            }
                            className="rounded p-2 text-haidee-muted hover:text-haidee-red"
                            title="删除 Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-haidee-border bg-haidee-surface/60">
                  <tr>
                    <td className="px-3 py-3 font-semibold text-haidee-text">
                      合计 Total /km
                    </td>
                    <td></td>
                    <td className="px-3 py-3 text-right font-mono text-base font-semibold text-haidee-blue">
                      {totalCostPerKm != null
                        ? totalCostPerKm.toFixed(4)
                        : "—"}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            启用 Active
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            取消 Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-haidee-blue text-white"
          >
            {isPending ? "保存中…" : "保存 Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
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

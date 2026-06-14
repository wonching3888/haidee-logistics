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
  FIXED_TRUCK_COST_ITEM_NAMES,
  fuelPriceForCountry,
  getTruckCountryMeta,
  loadTruckCostItems,
  prepareTruckCostItemsForSave,
  type TruckCountry,
} from "@/lib/constants/truck-cost";
import {
  calcCostPerKm,
  calcFuelCostPerKm,
  calcGrandTotalPerKm,
  formatTruckMoney,
} from "@/lib/truck-cost";

interface DriverOption {
  id: string;
  name: string;
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

interface CostRow {
  clientId: string;
  name: string;
  annualAmount: string;
  isFixed: boolean;
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

function newClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `row-${Date.now()}-${Math.random()}`;
}

function costRowsFromItems(items: { name: string; annualAmount: number }[]) {
  const loaded = loadTruckCostItems(
    items.length > 0 ? items : defaultCostItemsForCountry("MY")
  );

  return loaded.map((item) => ({
    clientId: item.name,
    name: item.name,
    annualAmount: item.annualAmount ? String(item.annualAmount) : "",
    isFixed: FIXED_TRUCK_COST_ITEM_NAMES.includes(
      item.name as (typeof FIXED_TRUCK_COST_ITEM_NAMES)[number]
    ),
  }));
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
  const [costRows, setCostRows] = useState<CostRow[]>([]);

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
    setCostRows(
      costRowsFromItems(
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
      costRows.map((row) => ({
        name: row.name,
        annualAmount: row.annualAmount ? Number(row.annualAmount) : 0,
      })),
    [costRows]
  );

  const fuelCostPerKm = calcFuelCostPerKm(
    currentFuelPrice,
    parsedFuelEfficiency
  );
  const grandTotalPerKm = calcGrandTotalPerKm(
    parsedCostItems,
    parsedAnnualMileage,
    fuelCostPerKm
  );

  function handleCountryChange(nextCountry: TruckCountry) {
    setCountry(nextCountry);
    setCostRows((prev) => {
      const customRows = prev.filter((row) => !row.isFixed);
      const fixedRows = costRowsFromItems(
        defaultCostItemsForCountry(nextCountry)
      );
      return [...fixedRows, ...customRows];
    });
  }

  function handleAddCustomItem() {
    setCostRows((prev) => [
      ...prev,
      {
        clientId: newClientId(),
        name: "",
        annualAmount: "",
        isFixed: false,
      },
    ]);
  }

  function handleRemoveCustomItem(clientId: string) {
    setCostRows((prev) => prev.filter((row) => row.clientId !== clientId));
  }

  function handleSave() {
    const rawItems = costRows
      .filter((row) => row.isFixed || row.name.trim())
      .map((row) => ({
        name: row.isFixed ? row.name : row.name.trim(),
        annualAmount: row.annualAmount ? Number(row.annualAmount) : 0,
      }));

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
      costItems: prepareTruckCostItemsForSave(rawItems),
      active,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
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
              油价在「营运设定 Operations Settings」页面统一维护。参考油耗成本：
              {formatTruckMoney(fuelCostPerKm, countryMeta.currency)}
            </p>
          </div>

          <div className="rounded-lg border border-haidee-border bg-white p-4">
            <h4 className="mb-3 text-sm font-semibold text-haidee-text">
              成本项目 Cost Items ({countryMeta.currency})
            </h4>

            <div className="overflow-hidden rounded-lg border border-haidee-border">
              <div className="flex items-center gap-3 bg-haidee-surface px-3 py-2 text-xs font-medium text-haidee-muted">
                <div className="min-w-0 flex-1">项目名称 Item</div>
                <div className="w-[150px] shrink-0 text-right">
                  年度总额 Annual ({countryMeta.currency})
                </div>
                <div className="w-[100px] shrink-0 text-right">/km</div>
                <div className="w-10 shrink-0 text-center">操作</div>
              </div>

              <div className="divide-y divide-haidee-border">
                {costRows.map((row) => {
                  const annualAmount = row.annualAmount
                    ? Number(row.annualAmount)
                    : 0;
                  const perKm = calcCostPerKm(
                    annualAmount,
                    parsedAnnualMileage
                  );

                  return (
                    <div
                      key={row.clientId}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        {row.isFixed ? (
                          <div className="min-h-[44px] rounded-lg border border-haidee-border bg-haidee-surface/40 px-3 py-2.5 text-sm text-haidee-text">
                            {row.name}
                          </div>
                        ) : (
                          <Input
                            value={row.name}
                            onChange={(e) =>
                              setCostRows((prev) =>
                                prev.map((item) =>
                                  item.clientId === row.clientId
                                    ? { ...item, name: e.target.value }
                                    : item
                                )
                              )
                            }
                            className="min-h-[44px] w-full text-sm"
                            placeholder="自定义项目名称"
                          />
                        )}
                      </div>
                      <div className="w-[150px] shrink-0">
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={row.annualAmount}
                          onChange={(e) =>
                            setCostRows((prev) =>
                              prev.map((item) =>
                                item.clientId === row.clientId
                                  ? { ...item, annualAmount: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="min-h-[44px] w-full text-right font-mono"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="w-[100px] shrink-0 text-right font-mono text-sm text-haidee-text">
                        {perKm != null ? perKm.toFixed(4) : "—"}
                      </div>
                      <div className="flex w-10 shrink-0 justify-center">
                        {!row.isFixed ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomItem(row.clientId)}
                            className="rounded p-1.5 text-haidee-red hover:bg-haidee-red/10"
                            aria-label="删除 Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-haidee-border px-3 py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomItem}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  新增项目 Add Item
                </Button>
              </div>

              <div className="flex items-center gap-3 border-t border-haidee-border bg-haidee-surface/60 px-3 py-3">
                <div className="min-w-0 flex-1 font-semibold text-haidee-text">
                  合计 Total /km
                </div>
                <div className="w-[150px] shrink-0" />
                <div className="w-[100px] shrink-0 text-right font-mono text-base font-semibold text-haidee-blue">
                  {grandTotalPerKm != null ? grandTotalPerKm.toFixed(4) : "—"}
                </div>
                <div className="w-10 shrink-0" />
              </div>
            </div>
            <p className="mt-2 text-xs text-haidee-muted">
              合计 = 柴油/km（{fuelCostPerKm?.toFixed(4) ?? "—"}）+ 所有成本项目
              /km 之和
            </p>
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

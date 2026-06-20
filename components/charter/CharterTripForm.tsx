"use client";

import { useEffect, useMemo, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  previewCharterCosts,
  saveCharterTrip,
} from "@/app/actions/charter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputField } from "@/components/shared/DateInputField";
import type { CharterCostPreview } from "@/lib/charter-costs";
import {
  charterBillingCompanyLabel,
  charterCargoTypeLabel,
  CHARTER_BILLING_COMPANIES,
  type CharterBillingCompany,
  type CharterCargoType,
  type CharterExtraItemRecord,
  type CharterTripRecord,
} from "@/lib/charter";

interface TruckOption {
  id: string;
  plate: string;
  type: string;
  defaultDriverId: string | null;
  defaultDriverName: string;
}

interface DriverOption {
  id: string;
  name: string;
}

interface TongTypeOption {
  id: string;
  code: string;
  name: string;
  isBox: boolean;
}

interface ShipperOption {
  id: string;
  code: string;
  name: string;
  pickupLocation: string;
}

interface LineDraft {
  key: string;
  tongTypeId: string;
  quantity: string;
}

interface ExtraItemDraft {
  key: string;
  amount: string;
  note: string;
}

interface CharterTripFormProps {
  mode: "new" | "edit";
  date: string;
  trucks: TruckOption[];
  drivers: DriverOption[];
  tongTypes: TongTypeOption[];
  shippers: ShipperOption[];
  initial?: CharterTripRecord | null;
}

function moneyField(value: number | null | undefined) {
  return value != null && value !== 0 ? String(value) : "";
}

function noteField(value: string | null | undefined) {
  return value ?? "";
}

function emptyLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    tongTypeId: "",
    quantity: "",
  };
}

function emptyExtraItem(): ExtraItemDraft {
  return {
    key: crypto.randomUUID(),
    amount: "",
    note: "",
  };
}

function extraItemsFromInitial(
  items: CharterExtraItemRecord[]
): ExtraItemDraft[] {
  if (!items.length) return [emptyExtraItem()];
  return items.map((item) => ({
    key: item.id,
    amount: moneyField(item.amountMyr),
    note: noteField(item.note),
  }));
}

function linesFromInitial(initial: CharterTripRecord | null | undefined): LineDraft[] {
  if (!initial?.lines.length) return [emptyLine()];
  return initial.lines.map((line) => ({
    key: line.id,
    tongTypeId: line.tongTypeId,
    quantity: String(line.quantity),
  }));
}

function formatMyr(value: number | null | undefined) {
  if (value == null) return "—";
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CharterTripForm({
  mode,
  date: initialDate,
  trucks,
  drivers,
  tongTypes,
  shippers,
  initial = null,
}: CharterTripFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(initial?.date ?? initialDate);
  const [cargoType, setCargoType] = useState<CharterCargoType>(
    initial?.cargoType ?? "seafood"
  );
  const [truckId, setTruckId] = useState(initial?.truckId ?? "");
  const [shipperId, setShipperId] = useState(initial?.shipperId ?? "");
  const [stockAreaNote, setStockAreaNote] = useState(
    noteField(initial?.stockAreaNote)
  );
  const [driverName, setDriverName] = useState(initial?.driverName ?? "");
  const [includeBorderFees, setIncludeBorderFees] = useState(
    initial?.includeBorderFees ?? false
  );
  const [mileageKm, setMileageKm] = useState(moneyField(initial?.charterMileageKm));
  const [revenueMyr, setRevenueMyr] = useState(
    moneyField(initial?.charterRevenueMyr)
  );
  const [unloadFeeMyr, setUnloadFeeMyr] = useState(
    moneyField(initial?.charterUnloadFeeMyr)
  );
  const [driverSalaryMyr, setDriverSalaryMyr] = useState(
    moneyField(initial?.charterDriverSalaryMyr)
  );
  const [tollMyr, setTollMyr] = useState(moneyField(initial?.charterTollMyr));
  const [totalQuantity, setTotalQuantity] = useState(
    initial?.totalQuantity != null ? String(initial.totalQuantity) : ""
  );
  const [otherCostMyr, setOtherCostMyr] = useState(
    moneyField(initial?.charterOtherCostMyr)
  );
  const [otherCostNote, setOtherCostNote] = useState(
    noteField(initial?.charterOtherCostNote)
  );
  const [billingCompany, setBillingCompany] = useState<CharterBillingCompany>(
    initial?.billingCompany ?? "haidee"
  );
  const [billToCustomerName, setBillToCustomerName] = useState(
    noteField(initial?.billToCustomerName)
  );
  const [extraRevenueItems, setExtraRevenueItems] = useState<ExtraItemDraft[]>(
    () => extraItemsFromInitial(initial?.extraRevenueItems ?? [])
  );
  const [extraCostItems, setExtraCostItems] = useState<ExtraItemDraft[]>(() =>
    extraItemsFromInitial(initial?.extraCostItems ?? [])
  );
  const [lines, setLines] = useState<LineDraft[]>(() => linesFromInitial(initial));
  const [preview, setPreview] = useState<CharterCostPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!truckId && trucks.length === 1) {
      setTruckId(trucks[0].id);
    }
  }, [truckId, trucks]);

  useEffect(() => {
    const truck = trucks.find((t) => t.id === truckId);
    if (!driverName && truck?.defaultDriverName) {
      setDriverName(truck.defaultDriverName);
    }
  }, [truckId, trucks, driverName]);

  const previewLines = useMemo(
    () =>
      lines
        .map((line) => ({
          tongTypeId: line.tongTypeId,
          quantity: parseInt(line.quantity, 10) || 0,
        }))
        .filter((line) => line.tongTypeId && line.quantity > 0),
    [lines]
  );

  useEffect(() => {
    if (!truckId) {
      setPreview(null);
      return;
    }

    const mileage = Number(mileageKm);
    if (!Number.isFinite(mileage) || mileage <= 0) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      previewCharterCosts({
        date,
        truckId,
        cargoType,
        includeBorderFees,
        mileageKm: mileage,
        lines: cargoType === "seafood" ? previewLines : [],
      })
        .then((result) => {
          if (!cancelled) setPreview(result);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    date,
    truckId,
    cargoType,
    includeBorderFees,
    mileageKm,
    previewLines,
  ]);

  function handleTruckChange(nextTruckId: string) {
    setTruckId(nextTruckId);
    const truck = trucks.find((t) => t.id === nextTruckId);
    if (truck?.defaultDriverName) {
      setDriverName(truck.defaultDriverName);
    }
  }

  function parseExtraItemsForSave(items: ExtraItemDraft[], itemType: "revenue" | "cost") {
    return items
      .map((item) => ({
        itemType,
        amountMyr: item.amount.trim(),
        note: item.note.trim() || null,
      }))
      .filter((item) => item.amountMyr !== "" && Number(item.amountMyr) !== 0);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveCharterTrip({
          id: initial?.id,
          date,
          truckId,
          shipperId: shipperId.trim() || null,
          stockAreaNote: cargoType === "seafood" ? stockAreaNote : null,
          billToCustomerName: billToCustomerName.trim() || null,
          billingCompany,
          driverName,
          cargoType,
          includeBorderFees,
          charterMileageKm: mileageKm,
          charterRevenueMyr: revenueMyr,
          totalQuantity,
          charterTollMyr: tollMyr,
          charterUnloadFeeMyr: unloadFeeMyr,
          charterDriverSalaryMyr: driverSalaryMyr,
          charterOtherCostMyr: otherCostMyr,
          charterOtherCostNote: otherCostNote,
          extraItems: [
            ...parseExtraItemsForSave(extraRevenueItems, "revenue"),
            ...parseExtraItemsForSave(extraCostItems, "cost"),
          ],
          lines:
            cargoType === "seafood"
              ? lines
                  .map((line) => ({
                    tongTypeId: line.tongTypeId,
                    quantity: parseInt(line.quantity, 10) || 0,
                  }))
                  .filter((line) => line.tongTypeId && line.quantity > 0)
              : [],
        });

        router.push(`/charter/${result.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败 Save failed");
      }
    });
  }

  function renderExtraItemList(
    label: string,
    items: ExtraItemDraft[],
    setItems: Dispatch<SetStateAction<ExtraItemDraft[]>>
  ) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-haidee-text">{label}</p>
        {items.map((item) => (
          <div key={item.key} className="flex flex-wrap items-start gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={item.amount}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((row) =>
                    row.key === item.key ? { ...row, amount: e.target.value } : row
                  )
                )
              }
              placeholder="金额 Amount"
              className="min-h-[44px] w-32 font-mono"
            />
            <Input
              value={item.note}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((row) =>
                    row.key === item.key ? { ...row, note: e.target.value } : row
                  )
                )
              }
              placeholder="说明 Note"
              className="min-h-[44px] min-w-[160px] flex-1"
            />
            <button
              type="button"
              onClick={() =>
                setItems((prev) =>
                  prev.length <= 1
                    ? prev
                    : prev.filter((row) => row.key !== item.key)
                )
              }
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-haidee-muted hover:text-haidee-red"
              aria-label="Remove item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setItems((prev) => [...prev, emptyExtraItem()])}
          className="min-h-[44px]"
        >
          <Plus className="mr-2 h-4 w-4" />
          添加一行 Add row
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/charter?date=${encodeURIComponent(date)}`}
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-haidee-muted hover:text-haidee-text"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表 Back to list
        </Link>
        {initial?.charterNo && (
          <span className="font-mono text-sm text-haidee-muted">
            {initial.charterNo}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-haidee-border bg-white p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-haidee-text">基本资料 Basic</h3>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">货类 Cargo type</label>
          <div className="flex flex-wrap gap-4">
            {(["seafood", "general"] as const).map((type) => (
              <label
                key={type}
                className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="cargoType"
                  checked={cargoType === type}
                  onChange={() => setCargoType(type)}
                  className="h-4 w-4 accent-haidee-navy"
                />
                {charterCargoTypeLabel(type)}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">出发日期 Date</label>
            <DateInputField value={date} onChange={setDate} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">车牌 Truck</label>
            <select
              value={truckId}
              onChange={(e) => handleTruckChange(e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-haidee-border bg-white px-3 text-sm"
            >
              <option value="">选择车牌 Select plate</option>
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.plate} ({truck.type})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">司机 Driver</label>
            <Input
              list="charter-driver-options"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="司机姓名"
              className="min-h-[44px]"
            />
            <datalist id="charter-driver-options">
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.name} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              寄货人 Shipper{cargoType === "general" ? "（可选 optional）" : ""}
            </label>
            <select
              value={shipperId}
              onChange={(e) => setShipperId(e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-haidee-border bg-white px-3 text-sm"
            >
              <option value="">选择寄货人 Select shipper</option>
              {shippers.map((shipper) => (
                <option key={shipper.id} value={shipper.id}>
                  {shipper.code} — {shipper.name}
                </option>
              ))}
            </select>
            {cargoType === "seafood" ? (
              <p className="text-xs text-haidee-muted">
                租桶（isRental）扣减该寄货人名下库存；顾客自有桶不扣减。
              </p>
            ) : (
              <p className="text-xs text-haidee-muted">
                可选关联寄货人；未选时可填下方 Bill To 客户名用于发票。
              </p>
            )}
          </div>
          {cargoType === "seafood" ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-haidee-text">
                仓库区域 Stock area（SADAO 可选）
              </label>
              <Input
                value={stockAreaNote}
                onChange={(e) => setStockAreaNote(e.target.value)}
                placeholder="例如 PANTAI REMIS，留空则用默认库位"
                className="min-h-[44px]"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-haidee-text">
                Bill To 客户名 Customer name
              </label>
              <Input
                value={billToCustomerName}
                onChange={(e) => setBillToCustomerName(e.target.value)}
                placeholder="无寄货人时填写，用于发票 Bill To"
                className="min-h-[44px]"
              />
            </div>
          )}
        </div>

        {cargoType === "seafood" && shipperId && (
          <p className="text-xs text-haidee-muted">
            发票 Bill To 将使用所选寄货人名称与地址。
          </p>
        )}
        {cargoType === "general" && shipperId && (
          <p className="text-xs text-haidee-muted">
            已选寄货人时发票 Bill To 优先用寄货人；Bill To 客户名将被忽略。
          </p>
        )}

        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-haidee-border bg-haidee-surface/30 px-4 py-3">
          <input
            type="checkbox"
            checked={includeBorderFees}
            onChange={(e) => setIncludeBorderFees(e.target.checked)}
            className="mt-1 h-4 w-4 accent-haidee-navy"
          />
          <span className="text-sm">
            <span className="font-medium text-haidee-text">计入过关费 Include border fees</span>
            <span className="mt-0.5 block text-haidee-muted">
              泰国进马来西亚包车才勾选；纯马来西亚本地包车请勿勾选。
              Check only for Thailand→Malaysia charters.
            </span>
          </span>
        </label>
      </div>

      {cargoType === "seafood" && (
        <div className="rounded-xl border border-haidee-border bg-white p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-haidee-text">
              海产桶型明细 Seafood crates
            </h3>
            <p className="mt-1 text-xs text-haidee-muted">
              录入桶型与数量，系统自动计算 LKIM 与租桶费。
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-haidee-border text-left text-haidee-muted">
                  <th className="pb-2 pr-3 font-medium">桶型 Crate</th>
                  <th className="pb-2 pr-3 font-medium">数量 Qty</th>
                  <th className="pb-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} className="border-b border-haidee-border/60">
                    <td className="py-2 pr-3">
                      <select
                        value={line.tongTypeId}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? { ...row, tongTypeId: e.target.value }
                                : row
                            )
                          )
                        }
                        className="min-h-[44px] w-full min-w-[140px] rounded-md border border-haidee-border bg-white px-3"
                      >
                        <option value="">选择桶型</option>
                        {tongTypes.map((tong) => (
                          <option key={tong.id} value={tong.id}>
                            {tong.code} — {tong.name}
                            {tong.isBox ? " (盒)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.key === line.key
                                ? { ...row, quantity: e.target.value }
                                : row
                            )
                          )
                        }
                        className="min-h-[44px] w-28 font-mono"
                      />
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setLines((prev) =>
                            prev.length <= 1
                              ? prev
                              : prev.filter((row) => row.key !== line.key)
                          )
                        }
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-haidee-muted hover:text-haidee-red"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            className="min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加一行 Add row
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-haidee-border bg-white p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-haidee-text">财务录入 Finance</h3>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-haidee-text">
            开票主体 Billing company
          </label>
          <div className="flex flex-wrap gap-4">
            {CHARTER_BILLING_COMPANIES.map((company) => (
              <label
                key={company}
                className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="billingCompany"
                  checked={billingCompany === company}
                  onChange={() => setBillingCompany(company)}
                  className="h-4 w-4 accent-haidee-navy"
                />
                {charterBillingCompanyLabel(company)}
              </label>
            ))}
          </div>
          <p className="text-xs text-haidee-muted">
            HAIDEE 为普通 INVOICE；WTL 为 TAX INVOICE（含 6% SST，明细行显示含税金额）。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              顾客总价 Revenue (MYR)
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={revenueMyr}
              onChange={(e) => setRevenueMyr(e.target.value)}
              className="min-h-[44px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              公里数 Mileage (km)
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={mileageKm}
              onChange={(e) => setMileageKm(e.target.value)}
              className="min-h-[44px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              司机薪资 Driver salary (MYR)
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={driverSalaryMyr}
              onChange={(e) => setDriverSalaryMyr(e.target.value)}
              className="min-h-[44px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              下货费 Unload fee (MYR)
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unloadFeeMyr}
              onChange={(e) => setUnloadFeeMyr(e.target.value)}
              className="min-h-[44px] font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              过路费 Toll (MYR)
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={tollMyr}
              onChange={(e) => setTollMyr(e.target.value)}
              className="min-h-[44px] font-mono"
              placeholder="手动录入实际过路费"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-haidee-text">
              实际总桶数 Total quantity (barrels)
            </label>
            <Input
              type="number"
              min={1}
              step={1}
              value={totalQuantity}
              onChange={(e) => setTotalQuantity(e.target.value)}
              className="min-h-[44px] w-full max-w-xs font-mono"
              placeholder="含非租桶/自有桶型在内的总桶数"
            />
            <p className="text-xs text-haidee-muted">
              与下方桶型明细分开录入；P&amp;L/运营报表统计用此数字（如 FISHCO 190 桶）。
            </p>
          </div>
        </div>

        {cargoType === "general" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-haidee-text">
                其他开销 Other cost (MYR)
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={otherCostMyr}
                onChange={(e) => setOtherCostMyr(e.target.value)}
                className="min-h-[44px] font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-haidee-text">
                其他开销说明 Note
              </label>
              <Input
                value={otherCostNote}
                onChange={(e) => setOtherCostNote(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
          </div>
        )}

        <div className="rounded-lg border border-dashed border-haidee-border bg-haidee-surface/30 p-4 space-y-6">
          <p className="text-xs font-medium text-haidee-muted">额外项 Extra items</p>
          {renderExtraItemList(
            "额外收费 Extra revenue（计入客户发票）",
            extraRevenueItems,
            setExtraRevenueItems
          )}
          {renderExtraItemList(
            "额外开销 Extra cost（内部成本，不出现在客户发票）",
            extraCostItems,
            setExtraCostItems
          )}
        </div>
      </div>

      {(preview || previewLoading) && (
        <div className="rounded-xl border border-haidee-border bg-haidee-surface/20 p-4">
          <h3 className="text-sm font-semibold text-haidee-text">
            自动成本预览 Cost preview
          </h3>
          <p className="mt-1 text-xs text-haidee-muted">
            保存时海产 LKIM / 租桶费会写入记录；过关费与车辆公里成本供参考，P&L 阶段接入。
          </p>
          {previewLoading && !preview ? (
            <p className="mt-3 text-sm text-haidee-muted">计算中…</p>
          ) : preview ? (
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
              {cargoType === "seafood" && (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-haidee-muted">LKIM</dt>
                    <dd className="font-mono">{formatMyr(preview.lkimMyr)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-haidee-muted">租桶费 Crate rental</dt>
                    <dd className="font-mono">{formatMyr(preview.crateRentalMyr)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-haidee-muted">过关费 Border fees</dt>
                <dd className="font-mono">
                  {includeBorderFees ? formatMyr(preview.borderFeesMyr) : "不计入 —"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-haidee-muted">车辆公里成本 Vehicle / km</dt>
                <dd className="font-mono">
                  {preview.vehicleCostPerKm != null
                    ? `${preview.vehicleCostPerKm.toFixed(4)} MYR/km → ${formatMyr(preview.vehicleCostMyr)}`
                    : "—"}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">{error}</p>
      )}

      <div className="flex flex-wrap gap-3 border-t border-haidee-border pt-4">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="min-h-[44px] bg-haidee-blue px-6 text-white hover:bg-haidee-blue/90"
        >
          {isPending
            ? "保存中… Saving…"
            : mode === "edit"
              ? "保存修改 Save changes"
              : "保存包车记录 Save charter"}
        </Button>
      </div>
    </div>
  );
}

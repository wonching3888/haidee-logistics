"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editCrateExport } from "@/app/actions/crateExport";
import {
  getTodayInboundByShipper,
  getTodayInboundByPickupLocation,
  getSadaoStock,
  getThVehiclesForShipper,
  saveTongExport,
} from "@/app/actions/tong";
import type { CrateExportEditData } from "@/app/actions/crateExport";
import {
  isLocationPoolShipperCode,
  stockLocationForPoolShipperCode,
} from "@/lib/constants/location-pool-shippers";
import { DateInputField } from "@/components/shared/DateInputField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDisplay } from "@/lib/date-utils";
import { toDateInputValue } from "@/lib/inbound-utils";

interface ShipperOption {
  id: string;
  code: string;
  name: string;
}

interface TongTypeOption {
  id: string;
  code: string;
  name: string;
}

interface ExportLineState {
  tongTypeId: string;
  code: string;
  name: string;
  suggested: number;
  stock: number;
  actual: string;
  shortage: number;
}

interface TongExportFormProps {
  shippers: ShipperOption[];
  tongTypes: TongTypeOption[];
  mode?: "create" | "edit";
  exportNo?: string;
  initialData?: CrateExportEditData;
}

export function TongExportForm({
  shippers,
  tongTypes,
  mode = "create",
  exportNo,
  initialData,
}: TongExportFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit" && Boolean(initialData && exportNo);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(
    initialData?.date ?? toDateInputValue(new Date())
  );
  const [shipperId, setShipperId] = useState(initialData?.shipperId ?? "");
  const [areaNote, setAreaNote] = useState(initialData?.areaNote ?? "");
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [thPlate, setThPlate] = useState(initialData?.thVehiclePlate ?? "");
  const [vehicleSuggestions, setVehicleSuggestions] = useState<string[]>([]);
  const [lines, setLines] = useState<ExportLineState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedShipper = shippers.find((s) => s.id === shipperId);
  const poolStockLocation = selectedShipper
    ? stockLocationForPoolShipperCode(selectedShipper.code)
    : null;
  const isLocationPoolShipper = selectedShipper
    ? isLocationPoolShipperCode(selectedShipper.code)
    : false;
  const lockedShipperName =
    initialData?.shipperName ??
    selectedShipper?.name ??
    "";

  useEffect(() => {
    if (!shipperId || !selectedShipper) {
      if (!isEdit) {
        setLines([]);
        setVehicleSuggestions([]);
        setLocation("");
      }
      return;
    }

    if (!isEdit && poolStockLocation) {
      setLocation(poolStockLocation);
    }

    const vehiclePromise = isLocationPoolShipper
      ? Promise.resolve([])
      : getThVehiclesForShipper(shipperId);

    if (isEdit && initialData) {
      Promise.all([getSadaoStock(), vehiclePromise]).then(([stock, vehicles]) => {
        setVehicleSuggestions(vehicles.map((v) => v.plate));

        const stockMap = Object.fromEntries(stock.map((s) => [s.code, s.stock]));
        const existingByTong = new Map(
          initialData.lines.map((line) => [line.tongTypeId, line])
        );

        setLines(
          tongTypes.map((t) => {
            const existing = existingByTong.get(t.id);
            const suggested = existing?.quantitySuggested ?? 0;
            const currentSadao = stockMap[t.code] ?? 0;
            const oldActual = existing?.quantityActual ?? 0;
            const stockQty = currentSadao + oldActual;
            const actualNum = existing ? oldActual : 0;
            const capped = Math.min(actualNum, stockQty);
            return {
              tongTypeId: t.id,
              code: t.code,
              name: t.name,
              suggested,
              stock: stockQty,
              actual: existing ? String(actualNum) : "0",
              shortage: Math.max(0, suggested - capped),
            };
          })
        );
      });
      return;
    }

    const inboundPromise = poolStockLocation
      ? getTodayInboundByPickupLocation(date, poolStockLocation)
      : getTodayInboundByShipper(date, shipperId);

    Promise.all([inboundPromise, getSadaoStock(), vehiclePromise]).then(
      ([inbound, stock, vehicles]) => {
        setVehicleSuggestions(vehicles.map((v) => v.plate));

        const stockMap = Object.fromEntries(stock.map((s) => [s.code, s.stock]));
        const inboundMap = Object.fromEntries(
          inbound.map((i) => [i.code, i.quantity])
        );

        setLines(
          tongTypes.map((t) => {
            const suggested = inboundMap[t.code] ?? 0;
            const stockQty = stockMap[t.code] ?? 0;
            const actual =
              suggested > 0 ? String(Math.min(suggested, stockQty)) : "0";
            const actualNum = parseInt(actual, 10) || 0;
            return {
              tongTypeId: t.id,
              code: t.code,
              name: t.name,
              suggested,
              stock: stockQty,
              actual,
              shortage: Math.max(0, suggested - actualNum),
            };
          })
        );
      }
    );
  }, [
    shipperId,
    date,
    tongTypes,
    selectedShipper,
    poolStockLocation,
    isLocationPoolShipper,
    isEdit,
    initialData,
  ]);

  function updateActual(tongTypeId: string, value: string) {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setLines((prev) =>
      prev.map((l) => {
        if (l.tongTypeId !== tongTypeId) return l;
        const actualNum = parseInt(value, 10) || 0;
        const capped = Math.min(actualNum, l.stock);
        return {
          ...l,
          actual: value,
          shortage: Math.max(0, l.suggested - capped),
        };
      })
    );
  }

  function handleConfirm() {
    setError(null);
    if (!shipperId) {
      setError("请选择寄货人 Please select consignor");
      return;
    }
    if (!thPlate) {
      setError("请填写泰国车牌 Please enter TH plate");
      return;
    }

    const payload = {
      date,
      shipperId,
      thVehiclePlate: thPlate,
      areaNote,
      location,
      lines: lines.map((l) => ({
        tongTypeId: l.tongTypeId,
        quantitySuggested: l.suggested,
        quantityActual: parseInt(l.actual, 10) || 0,
      })),
    };

    startTransition(async () => {
      try {
        if (isEdit && exportNo) {
          await editCrateExport(exportNo, payload);
          router.push(
            `/crate/export?date=${encodeURIComponent(date)}&updated=${encodeURIComponent(exportNo)}`
          );
          return;
        }

        const result = await saveTongExport(payload);
        const returnTo = `/crate/export?date=${encodeURIComponent(date)}`;
        router.push(
          `/crate/export/print?exportNo=${encodeURIComponent(result.exportNo)}&returnTo=${encodeURIComponent(returnTo)}`
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-haidee-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">日期 Date</label>
          {isEdit ? (
            <div className="flex min-h-[44px] items-center rounded-lg border border-dashed border-haidee-border bg-haidee-surface/50 px-3 text-sm text-haidee-text">
              {formatDisplay(date)}
            </div>
          ) : (
            <DateInputField value={date} onChange={setDate} />
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">
            寄货人 Consignor
          </label>
          {isEdit ? (
            <div className="flex min-h-[44px] items-center rounded-lg border border-dashed border-haidee-border bg-haidee-surface/50 px-3 text-sm text-haidee-text">
              {lockedShipperName}
            </div>
          ) : (
            <select
              value={shipperId}
              onChange={(e) => {
                setShipperId(e.target.value);
                setLocation("");
              }}
              className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
            >
              <option value="">— 选择 Select —</option>
              {shippers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">
            地区/备注 Area/Note
          </label>
          <Input
            value={areaNote}
            onChange={(e) => setAreaNote(e.target.value)}
            placeholder="地区/备注 Area/Note (选填 Optional)"
            className="min-h-[44px]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">
            产地 Location
          </label>
          {isLocationPoolShipper && poolStockLocation ? (
            <div className="flex min-h-[44px] items-center rounded-lg border border-dashed border-haidee-border bg-haidee-surface/50 px-3 text-sm text-haidee-text">
              {poolStockLocation}
            </div>
          ) : (
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="如 PHUKET、TOT (选填 Optional)"
              className="min-h-[44px]"
            />
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-haidee-text">
            泰国车牌 TH Plate
          </label>
          <Input
            list="th-plates-export"
            value={thPlate}
            onChange={(e) => setThPlate(e.target.value)}
            placeholder="70-1743"
            className="min-h-[44px] font-mono"
          />
          <datalist id="th-plates-export">
            {vehicleSuggestions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </div>

      {shipperId && (
        <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
                <th className="px-4 py-3 text-left">桶型 Crate Type</th>
                <th className="px-4 py-3 text-right">系统建议 Suggested</th>
                <th className="px-4 py-3 text-right">SADAO现货 Stock</th>
                <th className="px-4 py-3 text-right">实际给出 Actual</th>
                <th className="px-4 py-3 text-right">欠桶 Shortage</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.tongTypeId} className="border-b border-haidee-border/60">
                  <td className="px-4 py-3 font-medium">
                    {line.code} — {line.name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {line.suggested}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-haidee-muted">
                    {line.stock}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={line.actual}
                      onChange={(e) => updateActual(line.tongTypeId, e.target.value)}
                      className="min-h-[44px] w-24 rounded-lg border border-haidee-border px-3 text-right font-mono"
                    />
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-semibold ${
                      line.shortage > 0 ? "text-haidee-red" : "text-haidee-green"
                    }`}
                  >
                    {line.shortage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <Button
        onClick={handleConfirm}
        disabled={isPending || !shipperId}
        className="min-h-[44px] bg-haidee-blue text-white hover:bg-haidee-blue/90"
      >
        {isPending
          ? "处理中…"
          : isEdit
            ? "保存修改 Save Changes"
            : "确认归还 Confirm Export"}
      </Button>
    </div>
  );
}

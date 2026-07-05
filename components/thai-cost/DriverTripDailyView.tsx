"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteThaiVehicleTripDaily,
  saveThaiVehicleTripDaily,
  type ThaiDriverRow,
  type ThaiVehicleTripRow,
} from "@/app/actions/thai-cost-phase2";
import {
  THAI_DRIVER_TRIP_PLATE_OPTIONS,
  THAI_DRIVER_TRIP_PLATE_OTHER,
} from "@/lib/constants/thai-route-masters";
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

type DriverMode = "formal" | "rental";

export function DriverTripDailyView({
  year,
  month,
  drivers,
  trips,
  canWrite,
}: {
  year: number;
  month: number;
  drivers: ThaiDriverRow[];
  trips: ThaiVehicleTripRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [driverMode, setDriverMode] = useState<DriverMode>("formal");
  const [plateSelect, setPlateSelect] = useState<string>(
    THAI_DRIVER_TRIP_PLATE_OPTIONS[0]
  );
  const [otherPlate, setOtherPlate] = useState("");
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    driverId: drivers[0]?.id ?? "",
    rentalDriverName: "",
    station: "SONGKHLA" as "SONGKHLA" | "PATTANI",
    tongQty: "0",
    boxQty: "0",
    notes: "",
  });

  function changeMonth(y: number, m: number) {
    router.push(`/thai-cost/driver-trips?year=${y}&month=${m}`);
  }

  function resolvePlate(): string {
    if (plateSelect === THAI_DRIVER_TRIP_PLATE_OTHER) {
      return otherPlate.trim();
    }
    return plateSelect;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        司机趟次日常录入：每条记录对应一次出车（车牌 + 据点 + 桶/盒数）。
        保存后同步更新司机提成汇总（正式司机）与车辆明细表。租车司机填写姓名即可。
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          年
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => changeMonth(Number(e.target.value) || year, month)}
          />
        </label>
        <label className="space-y-1 text-sm">
          月
          <Input
            type="number"
            min={1}
            max={12}
            className="w-20"
            value={month}
            onChange={(e) => changeMonth(year, Number(e.target.value) || month)}
          />
        </label>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {canWrite && (
        <form
          className="space-y-4 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const truckPlate = resolvePlate();
            if (!truckPlate) {
              setError("请填写车牌");
              return;
            }
            startTransition(async () => {
              try {
                await saveThaiVehicleTripDaily({
                  date: form.date,
                  truckPlate,
                  station: form.station,
                  tongQty: Number(form.tongQty),
                  boxQty: Number(form.boxQty),
                  driverId: driverMode === "formal" ? form.driverId : null,
                  rentalDriverName:
                    driverMode === "rental" ? form.rentalDriverName : null,
                  notes: form.notes || null,
                });
                setForm((f) => ({
                  ...f,
                  tongQty: "0",
                  boxQty: "0",
                  notes: "",
                }));
                setOtherPlate("");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "失败");
              }
            });
          }}
        >
          {/* Row 1: date + station */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              日期
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              据点
              <select
                className="h-8 w-full rounded-lg border px-2 text-sm"
                value={form.station}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    station: e.target.value as "SONGKHLA" | "PATTANI",
                  }))
                }
              >
                <option value="SONGKHLA">宋卡</option>
                <option value="PATTANI">北大年</option>
              </select>
            </label>
          </div>

          {/* Row 2: plate + driver */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <span>车牌</span>
              <select
                className="h-8 w-full rounded-lg border px-2 text-sm font-mono"
                value={plateSelect}
                onChange={(e) => setPlateSelect(e.target.value)}
              >
                {THAI_DRIVER_TRIP_PLATE_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value={THAI_DRIVER_TRIP_PLATE_OTHER}>Other</option>
              </select>
              {plateSelect === THAI_DRIVER_TRIP_PLATE_OTHER && (
                <Input
                  className="mt-2 font-mono"
                  placeholder="手动输入车牌"
                  value={otherPlate}
                  onChange={(e) => setOtherPlate(e.target.value)}
                  required
                />
              )}
            </div>
            <div className="space-y-2 text-sm">
              <span className="font-medium">司机</span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={driverMode === "formal"}
                    onChange={() => setDriverMode("formal")}
                  />
                  正式司机
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={driverMode === "rental"}
                    onChange={() => setDriverMode("rental")}
                  />
                  租车司机
                </label>
              </div>
              {driverMode === "formal" ? (
                <select
                  className="h-8 w-full rounded-lg border px-2 text-sm"
                  value={form.driverId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, driverId: e.target.value }))
                  }
                >
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder="租车司机姓名"
                  value={form.rentalDriverName}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      rentalDriverName: e.target.value,
                    }))
                  }
                  required={driverMode === "rental"}
                />
              )}
            </div>
          </div>

          {/* Row 3: tong + box */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              桶数 (tong)
              <Input
                type="number"
                min={0}
                value={form.tongQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tongQty: e.target.value }))
                }
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              盒数 (box)
              <Input
                type="number"
                min={0}
                value={form.boxQty}
                onChange={(e) =>
                  setForm((f) => ({ ...f, boxQty: e.target.value }))
                }
                required
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            备注
            <Input
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </label>

          <Button
            type="submit"
            disabled={isPending}
            className="gap-1 bg-haidee-blue text-white"
          >
            <Plus className="h-4 w-4" /> 保存趟次
          </Button>
        </form>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日期</TableHead>
              <TableHead>车牌</TableHead>
              <TableHead>司机</TableHead>
              <TableHead>据点</TableHead>
              <TableHead className="text-right">桶</TableHead>
              <TableHead className="text-right">盒</TableHead>
              {canWrite && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 7 : 6}
                  className="py-8 text-center text-haidee-muted"
                >
                  该月暂无趟次记录
                </TableCell>
              </TableRow>
            ) : (
              trips.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDisplay(t.date)}</TableCell>
                  <TableCell className="font-mono">{t.truckPlate}</TableCell>
                  <TableCell>
                    {t.driverName ??
                      (t.rentedDriverName
                        ? `租车 · ${t.rentedDriverName}`
                        : "—")}
                  </TableCell>
                  <TableCell>
                    {t.station === "SONGKHLA" ? "宋卡" : "北大年"}
                  </TableCell>
                  <TableCell className="text-right">{t.tongQty}</TableCell>
                  <TableCell className="text-right">{t.boxQty}</TableCell>
                  {canWrite && (
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await deleteThaiVehicleTripDaily(t.id);
                            router.refresh();
                          })
                        }
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

export type { ThaiDriverRow, ThaiVehicleTripRow };

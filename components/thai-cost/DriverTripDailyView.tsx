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
import { useT } from "@/components/shared/locale-context";
import {
  THAI_DRIVER_TRIP_PLATE_OPTIONS,
  THAI_DRIVER_TRIP_PLATE_OTHER,
} from "@/lib/constants/thai-route-masters";
import {
  THAI_COST_STATION_LABELS,
  type ThaiCostStation,
} from "@/lib/constants/thai-cost";
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
  viewOnly = false,
}: {
  year: number;
  month: number;
  drivers: ThaiDriverRow[];
  trips: ThaiVehicleTripRow[];
  canWrite: boolean;
  /** When true, hide entry form and row actions (read-only list). */
  viewOnly?: boolean;
}) {
  const router = useRouter();
  const { tLocal, locale } = useT();
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

  function stationLabel(station: ThaiCostStation) {
    return THAI_COST_STATION_LABELS[station][locale];
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        {viewOnly
          ? tLocal("thaiCost.driverTrips.viewOnlyIntro")
          : tLocal("thaiCost.driverTrips.intro")}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          {tLocal("thaiCost.common.year")}
          <Input
            type="number"
            className="w-24"
            value={year}
            onChange={(e) => changeMonth(Number(e.target.value) || year, month)}
          />
        </label>
        <label className="space-y-1 text-sm">
          {tLocal("thaiCost.common.month")}
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

      {canWrite && !viewOnly && (
        <form
          className="space-y-4 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const truckPlate = resolvePlate();
            if (!truckPlate) {
              setError(tLocal("thaiCost.driverTrips.plateRequired"));
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
                setError(
                  err instanceof Error
                    ? err.message
                    : tLocal("thaiCost.common.failed")
                );
              }
            });
          }}
        >
          {/* Row 1: date + station */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              {tLocal("thaiCost.common.date")}
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
              {tLocal("thaiCost.common.station")}
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
                <option value="SONGKHLA">
                  {stationLabel("SONGKHLA")}
                </option>
                <option value="PATTANI">
                  {stationLabel("PATTANI")}
                </option>
              </select>
            </label>
          </div>

          {/* Row 2: plate + driver */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <span>{tLocal("thaiCost.common.plate")}</span>
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
                <option value={THAI_DRIVER_TRIP_PLATE_OTHER}>
                  {tLocal("thaiCost.driverTrips.plateOther")}
                </option>
              </select>
              {plateSelect === THAI_DRIVER_TRIP_PLATE_OTHER && (
                <Input
                  className="mt-2 font-mono"
                  placeholder={tLocal("thaiCost.driverTrips.platePlaceholder")}
                  value={otherPlate}
                  onChange={(e) => setOtherPlate(e.target.value)}
                  required
                />
              )}
            </div>
            <div className="space-y-2 text-sm">
              <span className="font-medium">
                {tLocal("thaiCost.common.driver")}
              </span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={driverMode === "formal"}
                    onChange={() => setDriverMode("formal")}
                  />
                  {tLocal("thaiCost.driverTrips.formalDriver")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={driverMode === "rental"}
                    onChange={() => setDriverMode("rental")}
                  />
                  {tLocal("thaiCost.driverTrips.rentedDriver")}
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
                  placeholder={tLocal(
                    "thaiCost.driverTrips.rentedNamePlaceholder"
                  )}
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
              {tLocal("thaiCost.driverTrips.crateQty")}
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
              {tLocal("thaiCost.driverTrips.boxQty")}
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
            {tLocal("thaiCost.common.notes")}
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
            <Plus className="h-4 w-4" /> {tLocal("thaiCost.driverTrips.saveTrip")}
          </Button>
        </form>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tLocal("thaiCost.common.date")}</TableHead>
              <TableHead>{tLocal("thaiCost.common.plate")}</TableHead>
              <TableHead>{tLocal("thaiCost.common.driver")}</TableHead>
              <TableHead>{tLocal("thaiCost.common.station")}</TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.driverTrips.crateCol")}
              </TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.driverTrips.boxCol")}
              </TableHead>
              {canWrite && !viewOnly && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite && !viewOnly ? 7 : 6}
                  className="py-8 text-center text-haidee-muted"
                >
                  {tLocal("thaiCost.driverTrips.noRecords")}
                </TableCell>
              </TableRow>
            ) : (
              trips.map((trip) => (
                <TableRow key={trip.id}>
                  <TableCell>{formatDisplay(trip.date)}</TableCell>
                  <TableCell className="font-mono">{trip.truckPlate}</TableCell>
                  <TableCell>
                    {trip.driverName ??
                      (trip.rentedDriverName
                        ? `${tLocal("thaiCost.driverTrips.rentedPrefix")} ${trip.rentedDriverName}`
                        : "—")}
                  </TableCell>
                  <TableCell>{stationLabel(trip.station)}</TableCell>
                  <TableCell className="text-right">{trip.tongQty}</TableCell>
                  <TableCell className="text-right">{trip.boxQty}</TableCell>
                  {canWrite && !viewOnly && (
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await deleteThaiVehicleTripDaily(trip.id);
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

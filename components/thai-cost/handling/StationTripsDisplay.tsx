"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteThaiVehicleTripDaily,
  listThaiVehicleTripsForDate,
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
  THAI_DRIVER_OTHER_NAME,
  THAI_VEHICLE_PNL_DEFAULT_SONGKHLA_DRIVER_NAME,
  THAI_VEHICLE_PNL_DEFAULT_SONGKHLA_PLATE,
} from "@/lib/thai-cost/thai-vehicle-pnl-constants";
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

/** Single driver dropdown: formal | other | rental (rental keeps RENTED: notes path). */
type DriverSelect = "formal" | "other" | "rental";

type TripFormState = {
  driverSelect: DriverSelect;
  plateSelect: string;
  otherPlate: string;
  driverId: string;
  rentalDriverName: string;
  tongQty: string;
  boxQty: string;
};

function formalDriversOnly(drivers: ThaiDriverRow[]): ThaiDriverRow[] {
  return drivers.filter((d) => d.active && d.name !== THAI_DRIVER_OTHER_NAME);
}

function defaultSongkhlaDriverId(drivers: ThaiDriverRow[]): string {
  const formal = formalDriversOnly(drivers);
  const dang =
    formal.find((d) => d.name === THAI_VEHICLE_PNL_DEFAULT_SONGKHLA_DRIVER_NAME) ??
    formal.find((d) => d.name.toUpperCase().includes("DANG"));
  return dang?.id ?? formal[0]?.id ?? "";
}

function emptyForm(
  drivers: ThaiDriverRow[],
  station: "SONGKHLA" | "PATTANI"
): TripFormState {
  const formal = formalDriversOnly(drivers);
  const isSk = station === "SONGKHLA";
  return {
    driverSelect: "formal",
    plateSelect: isSk
      ? THAI_VEHICLE_PNL_DEFAULT_SONGKHLA_PLATE
      : THAI_DRIVER_TRIP_PLATE_OPTIONS[0],
    otherPlate: "",
    driverId: isSk ? defaultSongkhlaDriverId(drivers) : (formal[0]?.id ?? ""),
    rentalDriverName: "",
    tongQty: "0",
    boxQty: "0",
  };
}

function formFromRow(
  row: ThaiVehicleTripRow,
  drivers: ThaiDriverRow[],
  station: "SONGKHLA" | "PATTANI"
): TripFormState {
  const inOptions = (
    THAI_DRIVER_TRIP_PLATE_OPTIONS as readonly string[]
  ).includes(row.truckPlate);
  const base = emptyForm(drivers, station);
  if (row.rentedDriverName) {
    return {
      ...base,
      driverSelect: "rental",
      plateSelect: inOptions ? row.truckPlate : THAI_DRIVER_TRIP_PLATE_OTHER,
      otherPlate: inOptions ? "" : row.truckPlate,
      rentalDriverName: row.rentedDriverName,
      tongQty: String(row.tongQty),
      boxQty: String(row.boxQty),
    };
  }
  if (row.driverName === THAI_DRIVER_OTHER_NAME) {
    return {
      ...base,
      driverSelect: "other",
      plateSelect: inOptions ? row.truckPlate : THAI_DRIVER_TRIP_PLATE_OTHER,
      otherPlate: inOptions ? "" : row.truckPlate,
      tongQty: String(row.tongQty),
      boxQty: String(row.boxQty),
    };
  }
  return {
    ...base,
    driverSelect: "formal",
    plateSelect: inOptions ? row.truckPlate : THAI_DRIVER_TRIP_PLATE_OTHER,
    otherPlate: inOptions ? "" : row.truckPlate,
    driverId: row.driverId ?? base.driverId,
    tongQty: String(row.tongQty),
    boxQty: String(row.boxQty),
  };
}

function resolvePlate(form: TripFormState): string {
  if (form.plateSelect === THAI_DRIVER_TRIP_PLATE_OTHER) {
    return form.otherPlate.trim();
  }
  return form.plateSelect;
}

export type TripVsDispatchMismatch = {
  crateMismatch: boolean;
  boxMismatch: boolean;
  tripCrateTotal: number;
  tripBoxTotal: number;
};

/** Editable trip list for a station/day. Writes thai_vehicle_trip_daily only. */
export function StationTripsDisplay({
  date,
  station,
  drivers,
  canWrite,
  /** Effective handling qty (same as resolveSongkhla/PattaniEffectiveQty → UI 派车总数). */
  effectiveCrateQty,
  effectiveBoxQty,
  onMismatchChange,
}: {
  date: string;
  station: "SONGKHLA" | "PATTANI";
  drivers: ThaiDriverRow[];
  canWrite: boolean;
  effectiveCrateQty: number;
  effectiveBoxQty: number;
  onMismatchChange?: (m: TripVsDispatchMismatch) => void;
}) {
  const router = useRouter();
  const { tLocal } = useT();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ThaiVehicleTripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<TripFormState>(() =>
    emptyForm(drivers, station)
  );
  const [editForm, setEditForm] = useState<TripFormState>(() =>
    emptyForm(drivers, station)
  );

  const formal = useMemo(() => formalDriversOnly(drivers), [drivers]);

  const tripCrateTotal = useMemo(
    () => rows.reduce((s, r) => s + r.tongQty, 0),
    [rows]
  );
  const tripBoxTotal = useMemo(
    () => rows.reduce((s, r) => s + r.boxQty, 0),
    [rows]
  );
  const crateMismatch = tripCrateTotal !== effectiveCrateQty;
  const boxMismatch = tripBoxTotal !== effectiveBoxQty;

  useEffect(() => {
    onMismatchChange?.({
      crateMismatch,
      boxMismatch,
      tripCrateTotal,
      tripBoxTotal,
    });
  }, [
    crateMismatch,
    boxMismatch,
    tripCrateTotal,
    tripBoxTotal,
    onMismatchChange,
  ]);

  const reload = useCallback(() => {
    setLoading(true);
    return listThaiVehicleTripsForDate({ date, station })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [date, station]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setShowAdd(false);
    setEditingId(null);
    setError(null);
    listThaiVehicleTripsForDate({ date, station })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, station]);

  useEffect(() => {
    setAddForm(emptyForm(drivers, station));
  }, [drivers, date, station]);

  function driverLabel(row: ThaiVehicleTripRow) {
    if (row.rentedDriverName) {
      return `${row.rentedDriverName} (${tLocal("thaiCost.driverTrips.rentedShort")})`;
    }
    if (row.driverName === THAI_DRIVER_OTHER_NAME) {
      return tLocal("thaiCost.driverTrips.otherDriver");
    }
    if (row.driverName) return row.driverName;
    return "—";
  }

  function saveTrip(id: string | undefined, form: TripFormState) {
    setError(null);
    const truckPlate = resolvePlate(form);
    if (!truckPlate) {
      setError(tLocal("thaiCost.driverTrips.plateRequired"));
      return;
    }
    startTransition(async () => {
      try {
        await saveThaiVehicleTripDaily({
          id,
          date,
          truckPlate,
          station,
          tongQty: Number(form.tongQty),
          boxQty: Number(form.boxQty),
          driverMode: form.driverSelect,
          driverId: form.driverSelect === "formal" ? form.driverId : null,
          rentalDriverName:
            form.driverSelect === "rental" ? form.rentalDriverName : null,
        });
        setShowAdd(false);
        setEditingId(null);
        setAddForm(emptyForm(drivers, station));
        await reload();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : tLocal("thaiCost.common.failed")
        );
      }
    });
  }

  function deleteTrip(id: string) {
    if (!confirm(tLocal("thaiCost.common.deleteConfirm"))) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteThaiVehicleTripDaily(id);
        if (editingId === id) setEditingId(null);
        await reload();
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : tLocal("thaiCost.common.failed")
        );
      }
    });
  }

  function renderDriverFields(
    form: TripFormState,
    setForm: (f: TripFormState) => void
  ) {
    return (
      <div className="space-y-2 text-sm">
        <label className="block space-y-1">
          <span>{tLocal("thaiCost.driverTrips.driverSelect")}</span>
          <select
            className="h-8 w-full rounded-lg border px-2 text-sm"
            value={
              form.driverSelect === "formal"
                ? form.driverId
                : form.driverSelect === "other"
                  ? "__OTHER__"
                  : "__RENTAL__"
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__OTHER__") {
                setForm({ ...form, driverSelect: "other", driverId: "" });
              } else if (v === "__RENTAL__") {
                setForm({ ...form, driverSelect: "rental", driverId: "" });
              } else {
                setForm({
                  ...form,
                  driverSelect: "formal",
                  driverId: v,
                });
              }
            }}
          >
            {formal.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            <option value="__OTHER__">
              {tLocal("thaiCost.driverTrips.otherDriver")}
            </option>
            <option value="__RENTAL__">
              {tLocal("thaiCost.driverTrips.rentedDriver")}
            </option>
          </select>
        </label>
        {form.driverSelect === "rental" && (
          <Input
            placeholder={tLocal("thaiCost.driverTrips.rentedNamePlaceholder")}
            value={form.rentalDriverName}
            onChange={(e) =>
              setForm({ ...form, rentalDriverName: e.target.value })
            }
            required
          />
        )}
      </div>
    );
  }

  function renderPlateFields(
    form: TripFormState,
    setForm: (f: TripFormState) => void
  ) {
    return (
      <div className="space-y-1 text-sm">
        <select
          className="h-8 w-full rounded-lg border px-2 text-sm font-mono"
          value={form.plateSelect}
          onChange={(e) => setForm({ ...form, plateSelect: e.target.value })}
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
        {form.plateSelect === THAI_DRIVER_TRIP_PLATE_OTHER && (
          <Input
            className="font-mono"
            placeholder={tLocal("thaiCost.driverTrips.platePlaceholder")}
            value={form.otherPlate}
            onChange={(e) => setForm({ ...form, otherPlate: e.target.value })}
            required
          />
        )}
      </div>
    );
  }

  function renderTripForm(
    id: string | undefined,
    form: TripFormState,
    setForm: (f: TripFormState) => void,
    onCancel: () => void
  ) {
    return (
      <div className="mt-3 space-y-3 rounded-lg border bg-haidee-surface/40 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span>{tLocal("thaiCost.driverTrips.plate")}</span>
            {renderPlateFields(form, setForm)}
          </label>
          {renderDriverFields(form, setForm)}
          <label className="space-y-1 text-sm">
            <span>{tLocal("thaiCost.handling.tripTong")}</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.tongQty}
              onChange={(e) => setForm({ ...form, tongQty: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>{tLocal("thaiCost.handling.tripBox")}</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={form.boxQty}
              onChange={(e) => setForm({ ...form, boxQty: e.target.value })}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-haidee-blue text-white"
            disabled={isPending}
            onClick={() => saveTrip(id, form)}
          >
            {tLocal("thaiCost.common.save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={onCancel}
          >
            {tLocal("thaiCost.common.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-haidee-border bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {tLocal("thaiCost.handling.tripsTitle")}
        </p>
        {canWrite && (
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-haidee-blue text-white"
            disabled={isPending || showAdd}
            onClick={() => {
              setEditingId(null);
              setAddForm(emptyForm(drivers, station));
              setShowAdd(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {tLocal("thaiCost.handling.tripsAdd")}
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-haidee-muted">
          {tLocal("thaiCost.common.loading")}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tLocal("thaiCost.driverTrips.plate")}</TableHead>
              <TableHead>{tLocal("thaiCost.driverTrips.driver")}</TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.vehiclePnl.crateBox")}
              </TableHead>
              {canWrite && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && !showAdd ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 4 : 3}
                  className="text-haidee-muted"
                >
                  {tLocal("thaiCost.handling.noTrips")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {editingId === row.id ? (
                    <TableCell colSpan={canWrite ? 4 : 3}>
                      {renderTripForm(row.id, editForm, setEditForm, () =>
                        setEditingId(null)
                      )}
                    </TableCell>
                  ) : (
                    <>
                      <TableCell className="font-mono">{row.truckPlate}</TableCell>
                      <TableCell>{driverLabel(row)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.tongQty}/{row.boxQty}
                      </TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => {
                              setShowAdd(false);
                              setEditForm(formFromRow(row, drivers, station));
                              setEditingId(row.id);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => deleteTrip(row.id)}
                          >
                            <Trash2 className="h-4 w-4 text-haidee-red" />
                          </Button>
                        </TableCell>
                      )}
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {!loading && (
        <p className="text-sm font-mono">
          <span className="text-haidee-muted">
            {tLocal("thaiCost.handling.tripSumLabel")}:{" "}
          </span>
          <span
            className={
              crateMismatch ? "font-semibold text-haidee-red" : undefined
            }
          >
            {tLocal("thaiCost.handling.tripTong")} {tripCrateTotal}
            {crateMismatch ? (
              <span className="ml-1 text-xs font-normal">
                ({tLocal("thaiCost.handling.qtyMismatch")})
              </span>
            ) : null}
          </span>
          <span className="text-haidee-muted"> / </span>
          <span
            className={
              boxMismatch ? "font-semibold text-haidee-red" : undefined
            }
          >
            {tLocal("thaiCost.handling.tripBox")} {tripBoxTotal}
            {boxMismatch ? (
              <span className="ml-1 text-xs font-normal">
                ({tLocal("thaiCost.handling.qtyMismatch")})
              </span>
            ) : null}
          </span>
        </p>
      )}

      {showAdd &&
        renderTripForm(undefined, addForm, setAddForm, () => setShowAdd(false))}
    </div>
  );
}

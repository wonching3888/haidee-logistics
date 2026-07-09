"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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

type DriverMode = "formal" | "rental";

type TripFormState = {
  driverMode: DriverMode;
  plateSelect: string;
  otherPlate: string;
  driverId: string;
  rentalDriverName: string;
  tongQty: string;
  boxQty: string;
};

function emptyForm(drivers: ThaiDriverRow[]): TripFormState {
  return {
    driverMode: "formal",
    plateSelect: THAI_DRIVER_TRIP_PLATE_OPTIONS[0],
    otherPlate: "",
    driverId: drivers[0]?.id ?? "",
    rentalDriverName: "",
    tongQty: "0",
    boxQty: "0",
  };
}

function formFromRow(row: ThaiVehicleTripRow, drivers: ThaiDriverRow[]): TripFormState {
  const inOptions = (
    THAI_DRIVER_TRIP_PLATE_OPTIONS as readonly string[]
  ).includes(row.truckPlate);
  return {
    driverMode: row.rentedDriverName ? "rental" : "formal",
    plateSelect: inOptions ? row.truckPlate : THAI_DRIVER_TRIP_PLATE_OTHER,
    otherPlate: inOptions ? "" : row.truckPlate,
    driverId: row.driverId ?? drivers[0]?.id ?? "",
    rentalDriverName: row.rentedDriverName ?? "",
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

/** Editable trip list for a station/day. Writes thai_vehicle_trip_daily only. */
export function StationTripsDisplay({
  date,
  station,
  drivers,
  canWrite,
}: {
  date: string;
  station: "SONGKHLA" | "PATTANI";
  drivers: ThaiDriverRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { tLocal } = useT();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<ThaiVehicleTripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<TripFormState>(() => emptyForm(drivers));
  const [editForm, setEditForm] = useState<TripFormState>(() => emptyForm(drivers));

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
    setAddForm(emptyForm(drivers));
  }, [drivers, date]);

  function driverLabel(row: ThaiVehicleTripRow) {
    if (row.driverName) return row.driverName;
    if (row.rentedDriverName) {
      return `${row.rentedDriverName} (${tLocal("thaiCost.handling.rentedDriver")})`;
    }
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
          driverId: form.driverMode === "formal" ? form.driverId : null,
          rentalDriverName:
            form.driverMode === "rental" ? form.rentalDriverName : null,
        });
        setShowAdd(false);
        setEditingId(null);
        setAddForm(emptyForm(drivers));
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
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={form.driverMode === "formal"}
              onChange={() => setForm({ ...form, driverMode: "formal" })}
            />
            {tLocal("thaiCost.driverTrips.formalDriver")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={form.driverMode === "rental"}
              onChange={() => setForm({ ...form, driverMode: "rental" })}
            />
            {tLocal("thaiCost.driverTrips.rentedDriver")}
          </label>
        </div>
        {form.driverMode === "formal" ? (
          <select
            className="h-8 w-full rounded-lg border px-2 text-sm"
            value={form.driverId}
            onChange={(e) => setForm({ ...form, driverId: e.target.value })}
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : (
          <Input
            placeholder={tLocal("thaiCost.driverTrips.rentedNamePlaceholder")}
            value={form.rentalDriverName}
            onChange={(e) =>
              setForm({ ...form, rentalDriverName: e.target.value })
            }
            required={form.driverMode === "rental"}
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
          <div className="space-y-1 text-sm">
            <span>{tLocal("thaiCost.common.plate")}</span>
            {renderPlateFields(form, setForm)}
          </div>
          <div className="space-y-1 text-sm">
            <span className="font-medium">{tLocal("thaiCost.common.driver")}</span>
            {renderDriverFields(form, setForm)}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            {tLocal("thaiCost.driverTrips.crateQty")}
            <Input
              type="number"
              min={0}
              value={form.tongQty}
              onChange={(e) => setForm({ ...form, tongQty: e.target.value })}
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            {tLocal("thaiCost.driverTrips.boxQty")}
            <Input
              type="number"
              min={0}
              value={form.boxQty}
              onChange={(e) => setForm({ ...form, boxQty: e.target.value })}
              required
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isPending}
            className="bg-haidee-blue text-white"
            onClick={() => saveTrip(id, form)}
          >
            {tLocal("thaiCost.driverTrips.saveTrip")}
          </Button>
          <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
            {tLocal("thaiCost.common.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-haidee-border bg-white p-3">
      <p className="text-sm font-medium">{tLocal("thaiCost.handling.tripsTitle")}</p>
      <p className="mt-1 text-xs text-haidee-muted">
        {tLocal("thaiCost.handling.tripsEntryNote")}
      </p>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-2 text-sm text-haidee-muted">
          {tLocal("thaiCost.common.loading")}
        </p>
      ) : rows.length === 0 && !showAdd ? (
        <p className="mt-2 text-sm text-haidee-muted">
          {tLocal("thaiCost.handling.noTrips")}
        </p>
      ) : (
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>{tLocal("thaiCost.handling.tripPlate")}</TableHead>
              <TableHead>{tLocal("thaiCost.handling.tripDriver")}</TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.handling.tripTong")}
              </TableHead>
              <TableHead className="text-right">
                {tLocal("thaiCost.handling.tripBox")}
              </TableHead>
              {canWrite && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) =>
              editingId === row.id ? (
                <TableRow key={row.id}>
                  <TableCell colSpan={canWrite ? 5 : 4}>
                    {renderTripForm(row.id, editForm, setEditForm, () =>
                      setEditingId(null)
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={row.id}>
                  <TableCell className="font-mono">{row.truckPlate}</TableCell>
                  <TableCell>{driverLabel(row)}</TableCell>
                  <TableCell className="text-right font-mono">{row.tongQty}</TableCell>
                  <TableCell className="text-right font-mono">{row.boxQty}</TableCell>
                  {canWrite && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            setEditingId(row.id);
                            setEditForm(formFromRow(row, drivers));
                            setShowAdd(false);
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
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      )}

      {canWrite && showAdd && renderTripForm(undefined, addForm, setAddForm, () => {
        setShowAdd(false);
        setAddForm(emptyForm(drivers));
      })}

      {canWrite && !showAdd && editingId === null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1"
          disabled={isPending}
          onClick={() => {
            setShowAdd(true);
            setAddForm(emptyForm(drivers));
          }}
        >
          <Plus className="h-4 w-4" />
          {tLocal("thaiCost.handling.tripsAdd")}
        </Button>
      )}
    </div>
  );
}

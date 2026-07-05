"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteThaiRentedVehicleTrip,
  saveThaiRentedVehicleTrip,
  type ThaiRentedVehicleTripRow,
} from "@/app/actions/thai-cost-phase2";
import { useT } from "@/components/shared/locale-context";
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

export function RentedVehiclesView({
  year,
  month,
  rows,
  canWrite,
}: {
  year: number;
  month: number;
  rows: ThaiRentedVehicleTripRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { tLocal, locale } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: `${year}-${String(month).padStart(2, "0")}-01`,
    station: "SONGKHLA" as "SONGKHLA" | "PATTANI",
    driverName: "",
    truckPlate: "",
    tripCost: "",
  });

  function stationLabel(station: ThaiCostStation) {
    return THAI_COST_STATION_LABELS[station][locale];
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        {tLocal("thaiCost.rentedVehicles.intro")}
      </p>
      <div className="flex flex-wrap gap-3">
        <Input
          type="number"
          className="w-24"
          value={year}
          onChange={(e) =>
            router.push(
              `/thai-cost/rented-vehicles?year=${Number(e.target.value) || year}&month=${month}`
            )
          }
        />
        <Input
          type="number"
          className="w-20"
          min={1}
          max={12}
          value={month}
          onChange={(e) =>
            router.push(
              `/thai-cost/rented-vehicles?year=${year}&month=${Number(e.target.value) || month}`
            )
          }
        />
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}
      {canWrite && (
        <form
          className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await saveThaiRentedVehicleTrip({
                  date: form.date,
                  station: form.station,
                  driverName: form.driverName,
                  truckPlate: form.truckPlate || null,
                  tripCost: Number(form.tripCost),
                });
                setForm((f) => ({ ...f, driverName: "", truckPlate: "", tripCost: "" }));
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
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            required
          />
          <select
            className="h-8 rounded-lg border px-2 text-sm"
            value={form.station}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                station: e.target.value as "SONGKHLA" | "PATTANI",
              }))
            }
          >
            <option value="SONGKHLA">{stationLabel("SONGKHLA")}</option>
            <option value="PATTANI">{stationLabel("PATTANI")}</option>
          </select>
          <Input
            placeholder={tLocal("thaiCost.rentedVehicles.driverNamePlaceholder")}
            value={form.driverName}
            onChange={(e) =>
              setForm((f) => ({ ...f, driverName: e.target.value }))
            }
            required
          />
          <Input
            placeholder={tLocal("thaiCost.rentedVehicles.plateOptional")}
            value={form.truckPlate}
            onChange={(e) =>
              setForm((f) => ({ ...f, truckPlate: e.target.value }))
            }
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder={tLocal("thaiCost.rentedVehicles.tripCostPlaceholder")}
            value={form.tripCost}
            onChange={(e) =>
              setForm((f) => ({ ...f, tripCost: e.target.value }))
            }
            required
          />
          <Button
            type="submit"
            disabled={isPending}
            className="gap-1 bg-haidee-blue text-white"
          >
            <Plus className="h-4 w-4" /> {tLocal("thaiCost.common.save")}
          </Button>
        </form>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tLocal("thaiCost.common.date")}</TableHead>
            <TableHead>{tLocal("thaiCost.common.station")}</TableHead>
            <TableHead>{tLocal("thaiCost.common.driver")}</TableHead>
            <TableHead>{tLocal("thaiCost.common.plate")}</TableHead>
            <TableHead className="text-right">
              {tLocal("thaiCost.rentedVehicles.colCost")}
            </TableHead>
            {canWrite && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canWrite ? 6 : 5} className="text-center text-haidee-muted">
                {tLocal("thaiCost.rentedVehicles.noRecords")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{formatDisplay(r.date)}</TableCell>
                <TableCell>{stationLabel(r.station)}</TableCell>
                <TableCell>{r.driverName}</TableCell>
                <TableCell>{r.truckPlate ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">
                  {r.tripCost.toFixed(2)}
                </TableCell>
                {canWrite && (
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await deleteThaiRentedVehicleTrip(r.id);
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
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveThaiRouteMaster } from "@/app/actions/thai-cost-phase2";
import type { ThaiRouteMasterRow } from "@/app/actions/thai-cost-phase2";
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

export function ThaiRoutesSettingsSection({
  routes,
  canWrite,
}: {
  routes: ThaiRouteMasterRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, ThaiRouteMasterRow>>(() =>
    Object.fromEntries(routes.map((r) => [r.id, { ...r }]))
  );

  useEffect(() => {
    setForm(Object.fromEntries(routes.map((r) => [r.id, { ...r }])));
  }, [routes]);

  function updateField(
    id: string,
    field: keyof Pick<
      ThaiRouteMasterRow,
      "sadooMileageKm" | "tollFee" | "parkingFee"
    >,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value === "" ? null : Number(value),
      },
    }));
  }

  return (
    <div className="rounded-lg border border-haidee-border p-4">
      <h3 className="text-sm font-medium">
        泰国路线 Thai Routes（THB 车辆成本参数）
      </h3>
      <p className="mt-1 text-xs text-haidee-muted">
        公里数用于泰国车辆趟次油费+保养计算（vehicle-trip-cost）。过路费/停车费已可编辑保存，
        尚未计入当前车辆成本公式，后续可接入。
      </p>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>路线</TableHead>
              <TableHead className="text-right">公里数 (km)</TableHead>
              <TableHead className="text-right">过路费 (THB)</TableHead>
              <TableHead className="text-right">停车费 (THB)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((r) => {
              const row = form[r.id] ?? r;
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="font-mono text-xs text-haidee-muted">
                      {r.code}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="font-mono text-right"
                      disabled={!canWrite}
                      value={row.sadooMileageKm ?? ""}
                      onChange={(e) =>
                        updateField(r.id, "sadooMileageKm", e.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="font-mono text-right"
                      disabled={!canWrite}
                      value={row.tollFee ?? ""}
                      onChange={(e) =>
                        updateField(r.id, "tollFee", e.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="font-mono text-right"
                      disabled={!canWrite}
                      value={row.parkingFee ?? ""}
                      onChange={(e) =>
                        updateField(r.id, "parkingFee", e.target.value)
                      }
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {canWrite && (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            disabled={isPending}
            className="bg-haidee-blue text-white"
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                try {
                  for (const r of routes) {
                    const row = form[r.id] ?? r;
                    await saveThaiRouteMaster({
                      id: row.id,
                      sadooMileageKm: row.sadooMileageKm,
                      tollFee: row.tollFee,
                      parkingFee: row.parkingFee,
                    });
                  }
                  setMessage("泰国路线已保存");
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "保存失败");
                }
              });
            }}
          >
            保存泰国路线
          </Button>
        </div>
      )}
    </div>
  );
}

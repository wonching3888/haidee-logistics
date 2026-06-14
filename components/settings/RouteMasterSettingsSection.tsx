"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteRouteMaster,
  saveRouteMaster,
} from "@/app/actions/route-master";
import {
  RouteFormDialog,
  formatRouteFeeTotal,
  formatRouteMarkets,
  parseRouteFormValue,
  routeToFormValue,
  type RouteMasterRow,
} from "@/components/settings/RouteFormDialog";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import { Badge } from "@/components/ui/badge";

interface RouteMasterSettingsSectionProps {
  routes: RouteMasterRow[];
}

export function RouteMasterSettingsSection({
  routes,
}: RouteMasterSettingsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [formValue, setFormValue] = useState(() => routeToFormValue());

  function runAction(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setDialogOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-haidee-muted">
        维护主要派车路线及 SADAO 出发里程、过路费、过境费等标准费用。OTHER
        路线用于包车等手动输入场景。
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          className="gap-2 bg-haidee-blue text-white"
          onClick={() => {
            setEditId(undefined);
            setFormValue(routeToFormValue());
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          新增路线
        </Button>
      </div>

      <ScrollMatrixTable heightOffset={320}>
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>路线 Route</TableHead>
              <TableHead>包含市场 Markets</TableHead>
              <TableHead className="text-right">SADAO (km)</TableHead>
              <TableHead className="text-right">费用合计 Total</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-haidee-muted">
                  暂无路线 No routes
                </TableCell>
              </TableRow>
            ) : (
              routes.map((route) => (
                <TableRow key={route.id}>
                  <TableCell>
                    <div className="font-medium">{route.name}</div>
                    <div className="font-mono text-xs text-haidee-muted">
                      {route.code}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatRouteMarkets(route.markets)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {route.sadooMileageKm != null
                      ? route.sadooMileageKm.toFixed(0)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatRouteFeeTotal(route)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={route.active ? "default" : "secondary"}>
                      {route.active ? "启用" : "停用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => {
                          setEditId(route.id);
                          setFormValue(routeToFormValue(route));
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        className="text-haidee-red hover:text-haidee-red"
                        onClick={() =>
                          runAction(async () => {
                            if (
                              !window.confirm(
                                `确定删除路线 ${route.name}？此操作不可恢复。`
                              )
                            ) {
                              return;
                            }
                            await deleteRouteMaster(route.id);
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollMatrixTable>

      <RouteFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editId ? "编辑路线 Edit Route" : "新增路线 New Route"}
        initialValue={formValue}
        isEdit={!!editId}
        isPending={isPending}
        onSave={(value) =>
          runAction(async () => {
            await saveRouteMaster({
              id: editId,
              ...parseRouteFormValue(value),
            });
          })
        }
      />
    </div>
  );
}

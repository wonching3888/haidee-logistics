"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelDispatchOrder,
  changeDispatchTruck,
} from "@/app/actions/dispatch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DispatchMarketLabel } from "@/components/dispatch/DispatchMarketLabel";
import { useCanWrite } from "@/components/shared/can-write-context";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TruckOption {
  id: string;
  plate: string;
  capacityTong: number | null;
}

interface DispatchOrderRow {
  id: string;
  dispatchNo: string | null;
  truckId: string;
  truckPlate: string;
  driverName: string | null;
  markets: string[];
  status: string;
  totalQty: number;
  capacity: number | null;
}

interface DispatchOrderListProps {
  orders: DispatchOrderRow[];
  trucks: TruckOption[];
}

export function DispatchOrderList({ orders, trucks }: DispatchOrderListProps) {
  const router = useRouter();
  const userCanWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DispatchOrderRow | null>(
    null
  );
  const [changeTarget, setChangeTarget] = useState<DispatchOrderRow | null>(
    null
  );
  const [newTruckId, setNewTruckId] = useState("");

  if (orders.length === 0) return null;

  function openChangeDialog(order: DispatchOrderRow) {
    setError(null);
    setChangeTarget(order);
    setNewTruckId(order.truckId);
  }

  function handleCancelConfirm() {
    if (!cancelTarget) return;
    setError(null);
    startTransition(async () => {
      try {
        await cancelDispatchOrder(cancelTarget.id);
        setCancelTarget(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "取消失败 Cancel failed");
      }
    });
  }

  function handleChangeConfirm() {
    if (!changeTarget || !newTruckId) return;
    if (newTruckId === changeTarget.truckId) {
      setChangeTarget(null);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await changeDispatchTruck(changeTarget.id, newTruckId);
        setChangeTarget(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "换车失败 Change failed");
      }
    });
  }

  return (
    <>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-haidee-text">
          今日派车单 Today&apos;s Dispatch Orders
        </h3>
        <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <TableHead>派车单号 DO No.</TableHead>
                <TableHead>车牌 Plate</TableHead>
                <TableHead>司机 Driver</TableHead>
                <TableHead className="min-w-[140px]">市场 Markets</TableHead>
                <TableHead className="text-right">装载 Load</TableHead>
                <TableHead>状态 Status</TableHead>
                {userCanWrite ? (
                  <TableHead className="text-right">操作</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">
                    {o.dispatchNo ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono">{o.truckPlate}</TableCell>
                  <TableCell>{o.driverName ?? "—"}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap items-center gap-1">
                      {o.markets.map((m) => (
                        <DispatchMarketLabel
                          key={m}
                          code={m}
                          className="shrink-0"
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {o.totalQty}
                    {o.capacity ? ` / ${o.capacity}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-haidee-green text-haidee-green"
                    >
                      {o.status}
                    </Badge>
                  </TableCell>
                  {userCanWrite ? (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <Link
                          href={`/dispatch/${o.id}`}
                          className="text-haidee-blue hover:underline"
                        >
                          编辑 Edit
                        </Link>
                        <span className="text-haidee-muted">|</span>
                        <button
                          type="button"
                          onClick={() => openChangeDialog(o)}
                          className="text-haidee-blue hover:underline"
                          disabled={isPending}
                        >
                          换车 Change
                        </button>
                        <span className="text-haidee-muted">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setCancelTarget(o);
                          }}
                          className="text-red-600 hover:underline"
                          disabled={isPending}
                        >
                          取消 Cancel
                        </button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {userCanWrite ? (
        <>
      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setCancelTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>取消派车单 Cancel Dispatch</DialogTitle>
            <DialogDescription>
              确认取消此派车单？桶数将退回未分配。
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={isPending}
            >
              返回 Back
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={isPending}
            >
              {isPending ? "处理中…" : "确认取消 Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={changeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setChangeTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>换车 Change Truck</DialogTitle>
            <DialogDescription>
              选择新车牌，桶数与市场分配保持不变。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              车牌 Plate
            </label>
            <select
              value={newTruckId}
              onChange={(e) => setNewTruckId(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 font-mono text-sm"
            >
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plate}
                  {t.capacityTong != null ? ` (${t.capacityTong}桶)` : ""}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangeTarget(null)}
              disabled={isPending}
            >
              返回 Back
            </Button>
            <Button onClick={handleChangeConfirm} disabled={isPending}>
              {isPending ? "处理中…" : "确认换车 Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      ) : null}
    </>
  );
}

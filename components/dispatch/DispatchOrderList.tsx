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
import { useT } from "@/components/shared/locale-context";
import { getMessageParts, t } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/messages";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserLanguage } from "@/types";

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

function BilingualTableHead({ messageKey }: { messageKey: MessageKey }) {
  const { parts } = useT();
  const { local, en } = parts(messageKey);
  return (
    <TableHead>
      <div>{local}</div>
      {en ? <div className="text-[10px] text-haidee-muted">{en}</div> : null}
    </TableHead>
  );
}

function formatDispatchStatus(status: string, locale: UserLanguage): string {
  if (status === "dispatched") return t("dispatch.status.dispatched", locale);
  if (status === "cancelled") return t("dispatch.status.cancelled", locale);
  return status;
}

export function DispatchOrderList({ orders, trucks }: DispatchOrderListProps) {
  const router = useRouter();
  const userCanWrite = useCanWrite();
  const { t: tr, tLocal, parts, locale } = useT();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DispatchOrderRow | null>(
    null
  );
  const [changeTarget, setChangeTarget] = useState<DispatchOrderRow | null>(
    null
  );
  const [newTruckId, setNewTruckId] = useState("");

  const crateUnit = parts("common.crateUnit").local;

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
        setError(
          e instanceof Error ? e.message : tr("dispatch.error.cancelFailed")
        );
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
        setError(
          e instanceof Error ? e.message : tr("dispatch.error.changeFailed")
        );
      }
    });
  }

  const todayTitle = getMessageParts("dispatch.todayOrders", locale);

  return (
    <>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-haidee-text">
          {todayTitle.local}
          {todayTitle.en ? ` ${todayTitle.en}` : ""}
        </h3>
        <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
                <BilingualTableHead messageKey="dispatch.doNo" />
                <BilingualTableHead messageKey="dispatch.plateField" />
                <BilingualTableHead messageKey="dispatch.driver" />
                <TableHead className="min-w-[140px]">
                  <div>{parts("dispatch.markets").local}</div>
                  <div className="text-[10px] text-haidee-muted">
                    {parts("dispatch.markets").en}
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div>{parts("dispatch.load").local}</div>
                  <div className="text-[10px] text-haidee-muted">
                    {parts("dispatch.load").en}
                  </div>
                </TableHead>
                <BilingualTableHead messageKey="common.status" />
                {userCanWrite ? (
                  <TableHead className="text-right">
                    <div>{parts("common.actions").local}</div>
                    <div className="text-[10px] text-haidee-muted">
                      {parts("common.actions").en}
                    </div>
                  </TableHead>
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
                      {formatDispatchStatus(o.status, locale)}
                    </Badge>
                  </TableCell>
                  {userCanWrite ? (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2 text-sm">
                        <Link
                          href={`/dispatch/${o.id}`}
                          className="text-haidee-blue hover:underline"
                        >
                          {tr("common.edit")}
                        </Link>
                        <span className="text-haidee-muted">|</span>
                        <button
                          type="button"
                          onClick={() => openChangeDialog(o)}
                          className="text-haidee-blue hover:underline"
                          disabled={isPending}
                        >
                          {tr("dispatch.changeTruck")}
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
                          {tr("common.cancel")}
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
            <DialogTitle>{tr("dispatch.cancelTitle")}</DialogTitle>
            <DialogDescription>
              {tLocal("dispatch.cancelConfirm")}
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
              {tr("common.back")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={isPending}
            >
              {isPending ? tr("common.processing") : tr("dispatch.confirmCancel")}
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
            <DialogTitle>{tr("dispatch.changeTruckTitle")}</DialogTitle>
            <DialogDescription>
              {tLocal("dispatch.changeTruckDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-haidee-text">
              {tr("dispatch.plateField")}
            </label>
            <select
              value={newTruckId}
              onChange={(e) => setNewTruckId(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-haidee-border bg-white px-3 font-mono text-sm"
            >
              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.plate}
                  {truck.capacityTong != null
                    ? ` (${truck.capacityTong}${crateUnit})`
                    : ""}
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
              {tr("common.back")}
            </Button>
            <Button onClick={handleChangeConfirm} disabled={isPending}>
              {isPending
                ? tr("common.processing")
                : tr("dispatch.confirmChangeTruck")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      ) : null}
    </>
  );
}

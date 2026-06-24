"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import {
  updateCustomerCrateStock,
  type CrateTypeColumn,
  type CustomerCrateStockRow,
  type PickupLocationStockSummary,
} from "@/app/actions/customerCrateStock";
import { MobileTruncatedName } from "@/components/shared/MobileTruncatedName";
import { useT } from "@/components/shared/locale-context";
import { formatPickupLocationLabel } from "@/lib/constants/pickup-locations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollMatrixTable } from "@/components/shared/ScrollMatrixTable";
import {
  stickyActionsColTableClass,
  stickyFirstTwoColTableClass,
} from "@/lib/table-scroll";
import { cn } from "@/lib/utils";

interface CustomerCrateStockViewProps {
  crateTypes: CrateTypeColumn[];
  rows: CustomerCrateStockRow[];
  pickupLocationSummaries: PickupLocationStockSummary[];
  initialSearch: string;
}

function qtyClass(qty: number) {
  return qty < 0 ? "font-mono text-red-600" : "font-mono";
}

function formatLocationLabel(location: string, unspecified: string) {
  if (location === "SONGKHLA" || location === "PATTANI") {
    return formatPickupLocationLabel(location);
  }
  return location || unspecified;
}

function rowGrandTotal(
  row: CustomerCrateStockRow,
  crateTypes: CrateTypeColumn[]
) {
  return crateTypes.reduce((sum, ct) => sum + (row.quantities[ct.id] ?? 0), 0);
}

export function CustomerCrateStockView({
  crateTypes,
  rows,
  pickupLocationSummaries,
  initialSearch,
}: CustomerCrateStockViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, parts } = useT();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<CustomerCrateStockRow | null>(null);
  const [editLocation, setEditLocation] = useState("");
  const [editQty, setEditQty] = useState<Record<string, string>>({});
  const [editNotes, setEditNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function applySearch() {
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set("q", search.trim());
    } else {
      params.delete("q");
    }
    startTransition(() => {
      router.push(`/crate/customer-stock?${params.toString()}`);
    });
  }

  function toggleExpand(shipperId: string) {
    setExpandedId((prev) => (prev === shipperId ? null : shipperId));
  }

  function openEdit(row: CustomerCrateStockRow) {
    setError(null);
    setEditRow(row);
    const defaultLoc =
      row.locations.find((l) => l.location === "")?.location ??
      row.locations[0]?.location ??
      "";
    setEditLocation(defaultLoc);
    const locRow =
      row.locations.find((l) => l.location === defaultLoc) ??
      row.locations[0];
    const qty: Record<string, string> = {};
    for (const crateType of crateTypes) {
      qty[crateType.id] = String(locRow?.quantities[crateType.id] ?? 0);
    }
    setEditQty(qty);
    setEditNotes("");
  }

  function openEditSummary(summary: PickupLocationStockSummary) {
    if (!summary.shipperId) return;
    openEdit({
      shipperId: summary.shipperId,
      shipperCode: "",
      shipperName: summary.shipperName,
      quantities: summary.quantities,
      locations: [
        { location: summary.location, quantities: summary.quantities },
      ],
    });
  }

  function handleEditLocationChange(location: string) {
    if (!editRow) return;
    setEditLocation(location);
    const locRow = editRow.locations.find((l) => l.location === location);
    const qty: Record<string, string> = {};
    for (const crateType of crateTypes) {
      qty[crateType.id] = String(locRow?.quantities[crateType.id] ?? 0);
    }
    setEditQty(qty);
  }

  function handleSaveEdit() {
    if (!editRow) return;
    setError(null);
    startTransition(async () => {
      try {
        const locRow = editRow.locations.find(
          (l) => l.location === editLocation
        );
        for (const crateType of crateTypes) {
          const nextQty = parseInt(editQty[crateType.id] ?? "0", 10);
          if (Number.isNaN(nextQty)) {
            throw new Error(
              t("customerCrateStock.error.invalidQty", { code: crateType.code })
            );
          }
          const prevQty = locRow?.quantities[crateType.id] ?? 0;
          if (nextQty !== prevQty) {
            await updateCustomerCrateStock(
              editRow.shipperId,
              crateType.id,
              nextQty,
              editLocation,
              editNotes || undefined
            );
          }
        }
        setEditRow(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("error.saveFailed"));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-haidee-border bg-white p-4">
        <div className="min-w-[240px] flex-1 space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            {t("customerCrateStock.searchShipper")}
          </label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            placeholder={parts("inbound.searchPlaceholder").local}
            className="min-h-[44px]"
          />
        </div>
        <Button
          onClick={applySearch}
          disabled={isPending}
          className="min-h-[44px]"
        >
          {t("inbound.searchButton")}
        </Button>
      </div>

      <p className="text-xs text-haidee-muted">
        {t("customerCrateStock.hint")}
      </p>

      <ScrollMatrixTable heightOffset={280}>
        <Table
          noScrollContainer
          className={cn(stickyFirstTwoColTableClass, stickyActionsColTableClass)}
        >
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead className="w-8" />
              <TableHead>{t("common.consignor")}</TableHead>
              {crateTypes.map((ct) => (
                <TableHead key={ct.id} className="text-right font-mono text-xs">
                  {ct.code}
                </TableHead>
              ))}
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pickupLocationSummaries.map((summary) => (
              <TableRow key={`pickup-${summary.location}`}>
                <TableCell />
                <TableCell className="font-medium">
                  <MobileTruncatedName text={summary.title} />
                </TableCell>
                {crateTypes.map((ct) => {
                  const qty = summary.quantities[ct.id] ?? 0;
                  return (
                    <TableCell
                      key={ct.id}
                      className={cn("text-right", qtyClass(qty))}
                    >
                      {qty}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right">
                  {summary.shipperId ? (
                    <button
                      type="button"
                      onClick={() => openEditSummary(summary)}
                      className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center text-haidee-blue hover:text-haidee-blue/80"
                      aria-label={t("common.edit")}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={crateTypes.length + 3}
                  className="py-8 text-center text-haidee-muted"
                >
                  {t("customerCrateStock.emptySearch")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isExpanded = expandedId === row.shipperId;
                const grandTotal = rowGrandTotal(row, crateTypes);
                const visibleLocations = row.locations.filter((loc) =>
                  crateTypes.some((ct) => (loc.quantities[ct.id] ?? 0) !== 0)
                );

                return (
                  <Fragment key={row.shipperId}>
                    <TableRow>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleExpand(row.shipperId)}
                          className="flex min-h-[32px] min-w-[32px] items-center justify-center text-haidee-muted hover:text-haidee-text"
                          aria-label={t("customerCrateStock.expandAria")}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">
                        <MobileTruncatedName text={row.shipperName} />
                      </TableCell>
                      {crateTypes.map((ct) => {
                        const qty = row.quantities[ct.id] ?? 0;
                        return (
                          <TableCell
                            key={ct.id}
                            className={cn("text-right", qtyClass(qty))}
                          >
                            {qty}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center text-haidee-blue hover:text-haidee-blue/80"
                          aria-label={t("common.edit")}
                          disabled={isPending}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell
                          colSpan={crateTypes.length + 3}
                          className="bg-haidee-surface/50 p-0"
                        >
                          <div className="px-4 py-3 font-mono text-sm">
                            <p className="mb-2 text-xs font-semibold text-haidee-muted">
                              <MobileTruncatedName text={row.shipperName} />
                              <span className="ml-3">
                                {t("common.total")}:{" "}
                                <span className={qtyClass(grandTotal)}>
                                  {grandTotal}
                                </span>
                              </span>
                            </p>
                            {visibleLocations.length === 0 ? (
                              <p className="text-haidee-muted">
                                {t("customerCrateStock.noLocationBreakdown")}
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {visibleLocations.map((loc, index) => {
                                  const isLast =
                                    index === visibleLocations.length - 1;
                                  const prefix = isLast ? "└──" : "├──";
                                  const crateParts = crateTypes
                                    .filter(
                                      (ct) => (loc.quantities[ct.id] ?? 0) !== 0
                                    )
                                    .map(
                                      (ct) =>
                                        `${ct.code}  ${loc.quantities[ct.id]}`
                                    );

                                  return (
                                    <div
                                      key={loc.location || "__empty__"}
                                      className="flex flex-wrap items-baseline gap-x-3 text-haidee-text"
                                    >
                                      <span className="text-haidee-muted">
                                        {prefix}
                                      </span>
                                      <span className="min-w-[88px] font-medium">
                                        {formatLocationLabel(
                                          loc.location,
                                          parts("customerCrateStock.unspecifiedLocation")
                                            .local
                                        )}
                                      </span>
                                      {crateParts.map((part) => (
                                        <span
                                          key={part}
                                          className={qtyClass(
                                            parseInt(part.split(/\s+/)[1], 10)
                                          )}
                                        >
                                          {part}
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </ScrollMatrixTable>

      <Dialog
        open={editRow !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setEditRow(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editRow
                ? t("customerCrateStock.editTitle", {
                    shipperName: editRow.shipperName,
                  })
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editRow && editRow.locations.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-haidee-muted">
                  {t("crateExport.location")}
                </label>
                <select
                  value={editLocation}
                  onChange={(e) => handleEditLocationChange(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-haidee-border px-3 text-sm"
                >
                  {editRow.locations.map((loc) => (
                    <option key={loc.location || "__empty__"} value={loc.location}>
                      {formatLocationLabel(
                        loc.location,
                        parts("customerCrateStock.unspecifiedLocation").local
                      )}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {crateTypes.map((ct) => (
              <div
                key={ct.id}
                className="flex items-center justify-between gap-4"
              >
                <label className="min-w-[80px] font-mono text-sm">{ct.code}</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editQty[ct.id] ?? "0"}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "" || next === "-" || /^-?\d*$/.test(next)) {
                      setEditQty((prev) => ({
                        ...prev,
                        [ct.id]: next,
                      }));
                    }
                  }}
                  className="max-w-[140px] font-mono"
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs font-medium text-haidee-muted">
                {t("common.notes")}
              </label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder={parts("common.optional").local}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditRow(null)}
              disabled={isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

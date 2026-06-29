"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import {
  updateCustomerCrateStock,
  type CrateTypeColumn,
  type CustomerCrateStockRow,
  type PickupLocationStockSummary,
} from "@/app/actions/customerCrateStock";
import type {
  AssignedMemberSearchHint,
  CrateStockAgentRow,
  EligibleAgentMemberOption,
} from "@/app/actions/customer-crate-stock-agent";
import {
  CrateStockAgentAddMemberDialog,
  CrateStockAgentConfirmDialog,
  CrateStockAgentCreateDialog,
} from "@/components/crate/CrateStockAgentDialogs";
import { MobileTruncatedName } from "@/components/shared/MobileTruncatedName";
import { DataFreshnessBar } from "@/components/shared/DataFreshnessBar";
import { useT } from "@/components/shared/locale-context";
import { formatPickupLocationLabel } from "@/lib/constants/pickup-locations";
import { filterCrateTypesForCustomerStockDisplay } from "@/lib/constants/customer-crate-stock-display";
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
  agents: CrateStockAgentRow[];
  pickupLocationSummaries: PickupLocationStockSummary[];
  assignedMemberHints: AssignedMemberSearchHint[];
  initialSearch: string;
  isAdmin: boolean;
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

function memberStockSummary(
  quantities: Record<string, number>,
  crateTypes: CrateTypeColumn[]
) {
  const parts = crateTypes
    .filter((ct) => (quantities[ct.id] ?? 0) !== 0)
    .map((ct) => `${ct.code} ${quantities[ct.id]}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function CustomerCrateStockView({
  crateTypes,
  rows,
  agents,
  pickupLocationSummaries,
  assignedMemberHints,
  initialSearch,
  isAdmin,
}: CustomerCrateStockViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, parts } = useT();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const [addMemberAgent, setAddMemberAgent] = useState<CrateStockAgentRow | null>(
    null
  );
  const [confirmAction, setConfirmAction] = useState<{
    type: "join" | "remove";
    agentId: string;
    agentName: string;
    memberId: string;
    memberName: string;
  } | null>(null);
  const [editRow, setEditRow] = useState<CustomerCrateStockRow | null>(null);
  const [editLocation, setEditLocation] = useState("");
  const [editQty, setEditQty] = useState<Record<string, string>>({});
  const [editNotes, setEditNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visibleCrateTypes = useMemo(
    () => filterCrateTypesForCustomerStockDisplay(crateTypes),
    [crateTypes]
  );

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

  function toggleAgentExpand(agentId: string) {
    setExpandedAgentId((prev) => (prev === agentId ? null : agentId));
  }

  function openEditAgent(agent: CrateStockAgentRow) {
    openEdit({
      shipperId: agent.shipperId,
      shipperCode: agent.shipperCode,
      shipperName: agent.shipperName,
      quantities: agent.quantities,
      locations: agent.locations,
    });
  }

  function requestJoin(
    agent: CrateStockAgentRow,
    member: EligibleAgentMemberOption
  ) {
    setConfirmAction({
      type: "join",
      agentId: agent.shipperId,
      agentName: agent.shipperName,
      memberId: member.id,
      memberName: member.name,
    });
  }

  function requestRemove(agent: CrateStockAgentRow, memberId: string, memberName: string) {
    setConfirmAction({
      type: "remove",
      agentId: agent.shipperId,
      agentName: agent.shipperName,
      memberId,
      memberName,
    });
  }

  function renderLocationBreakdown(
    locations: CustomerCrateStockRow["locations"],
    title: string
  ) {
    const visibleLocations = locations.filter((loc) =>
      visibleCrateTypes.some((ct) => (loc.quantities[ct.id] ?? 0) !== 0)
    );
    const grandTotal = visibleCrateTypes.reduce(
      (sum, ct) =>
        sum +
        locations.reduce((locSum, loc) => locSum + (loc.quantities[ct.id] ?? 0), 0),
      0
    );

    return (
      <div className="px-4 py-3 font-mono text-sm">
        <p className="mb-2 text-xs font-semibold text-haidee-muted">
          <MobileTruncatedName text={title} />
          <span className="ml-3">
            {t("common.total")}:{" "}
            <span className={qtyClass(grandTotal)}>{grandTotal}</span>
          </span>
        </p>
        {visibleLocations.length === 0 ? (
          <p className="text-haidee-muted">
            {t("customerCrateStock.noLocationBreakdown")}
          </p>
        ) : (
          <div className="space-y-1">
            {visibleLocations.map((loc, index) => {
              const isLast = index === visibleLocations.length - 1;
              const prefix = isLast ? "└──" : "├──";
              const crateParts = visibleCrateTypes
                .filter((ct) => (loc.quantities[ct.id] ?? 0) !== 0)
                .map((ct) => `${ct.code}  ${loc.quantities[ct.id]}`);

              return (
                <div
                  key={loc.location || "__empty__"}
                  className="flex flex-wrap items-baseline gap-x-3 text-haidee-text"
                >
                  <span className="text-haidee-muted">{prefix}</span>
                  <span className="min-w-[88px] font-medium">
                    {formatLocationLabel(
                      loc.location,
                      parts("customerCrateStock.unspecifiedLocation").local
                    )}
                  </span>
                  {crateParts.map((part) => (
                    <span
                      key={part}
                      className={qtyClass(parseInt(part.split(/\s+/)[1], 10))}
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
    );
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
    for (const crateType of visibleCrateTypes) {
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
    for (const crateType of visibleCrateTypes) {
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
        for (const crateType of visibleCrateTypes) {
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
        {isAdmin ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setCreateAgentOpen(true)}
            disabled={isPending}
            className="min-h-[44px]"
          >
            {t("customerCrateStock.agent.create")}
          </Button>
        ) : null}
      </div>

      <DataFreshnessBar
        scope="customer-crate-stock"
        params={{ q: searchParams.get("q") ?? undefined }}
        onRefresh={() => router.refresh()}
      />

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
              {visibleCrateTypes.map((ct) => (
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
                {visibleCrateTypes.map((ct) => {
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
            {agents.map((agent) => {
              const isAgentExpanded = expandedAgentId === agent.shipperId;
              return (
                <Fragment key={`agent-${agent.shipperId}`}>
                  <TableRow className="bg-amber-50/40">
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => toggleAgentExpand(agent.shipperId)}
                        className="flex min-h-[32px] min-w-[32px] items-center justify-center text-haidee-muted hover:text-haidee-text"
                        aria-label={t("customerCrateStock.agent.membersTitle")}
                      >
                        {isAgentExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <MobileTruncatedName text={agent.shipperName} />
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                          {t("customerCrateStock.agent.badge")}
                        </span>
                      </div>
                    </TableCell>
                    {visibleCrateTypes.map((ct) => {
                      const qty = agent.quantities[ct.id] ?? 0;
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
                        onClick={() => openEditAgent(agent)}
                        className="inline-flex min-h-[32px] min-w-[32px] items-center justify-center text-haidee-blue hover:text-haidee-blue/80"
                        aria-label={t("common.edit")}
                        disabled={isPending}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                  {isAgentExpanded && (
                    <TableRow>
                      <TableCell
                        colSpan={visibleCrateTypes.length + 3}
                        className="bg-haidee-surface/50 p-0"
                      >
                        <div className="space-y-4 border-t border-haidee-border/60 px-4 py-3">
                          {agent.isLegacyPool ? (
                            <p className="text-xs text-amber-800">
                              {t("customerCrateStock.agent.legacyPoolHint")}
                            </p>
                          ) : null}
                          {renderLocationBreakdown(
                            agent.locations,
                            agent.shipperName
                          )}
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-haidee-muted">
                                {t("customerCrateStock.agent.membersTitle")}
                              </p>
                              {isAdmin ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setAddMemberAgent(agent)}
                                >
                                  {t("customerCrateStock.agent.addMember")}
                                </Button>
                              ) : null}
                            </div>
                            {agent.members.length === 0 ? (
                              <p className="text-sm text-haidee-muted">
                                {t("customerCrateStock.agent.noMembers")}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {agent.members.map((member) => (
                                  <div
                                    key={member.memberShipperId}
                                    className="rounded-lg border border-haidee-border bg-white p-3"
                                  >
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-sm font-medium">
                                        {member.memberShipperName}
                                      </p>
                                      {isAdmin ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            requestRemove(
                                              agent,
                                              member.memberShipperId,
                                              member.memberShipperName
                                            )
                                          }
                                        >
                                          {t("customerCrateStock.agent.removeMember")}
                                        </Button>
                                      ) : null}
                                    </div>
                                    <p className="font-mono text-xs text-haidee-muted">
                                      {memberStockSummary(
                                        member.quantities,
                                        visibleCrateTypes
                                      )}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
            {assignedMemberHints.map((hint) => (
              <TableRow
                key={`assigned-${hint.shipperId}`}
                className="bg-haidee-surface/40 text-haidee-muted"
              >
                <TableCell />
                <TableCell>
                  <div className="space-y-1">
                    <MobileTruncatedName text={hint.shipperName} />
                    <p className="text-[11px]">
                      {t("customerCrateStock.agent.memberAssigned", {
                        agent: hint.agentName,
                      })}
                    </p>
                  </div>
                </TableCell>
                {visibleCrateTypes.map((ct) => (
                  <TableCell key={ct.id} className="text-right font-mono">
                    —
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            ))}
            {rows.length === 0 && assignedMemberHints.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleCrateTypes.length + 3}
                  className="py-8 text-center text-haidee-muted"
                >
                  {t("customerCrateStock.emptySearch")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const isExpanded = expandedId === row.shipperId;

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
                      {visibleCrateTypes.map((ct) => {
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
                          colSpan={visibleCrateTypes.length + 3}
                          className="bg-haidee-surface/50 p-0"
                        >
                          {renderLocationBreakdown(row.locations, row.shipperName)}
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
            {visibleCrateTypes.map((ct) => (
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

      <CrateStockAgentCreateDialog
        open={createAgentOpen}
        onOpenChange={setCreateAgentOpen}
      />
      <CrateStockAgentConfirmDialog
        action={confirmAction}
        onClose={() => setConfirmAction(null)}
      />
      {addMemberAgent ? (
        <CrateStockAgentAddMemberDialog
          open={addMemberAgent !== null}
          agentName={addMemberAgent.shipperName}
          onOpenChange={(open) => {
            if (!open) setAddMemberAgent(null);
          }}
          onRequestJoin={(member) => requestJoin(addMemberAgent, member)}
        />
      ) : null}
    </div>
  );
}

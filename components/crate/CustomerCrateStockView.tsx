"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import {
  getCustomerCrateLedger,
  updateCustomerCrateStock,
  type CrateTypeColumn,
  type CustomerCrateLedgerEntry,
  type CustomerCrateStockRow,
} from "@/app/actions/customerCrateStock";
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
import { cn } from "@/lib/utils";

interface CustomerCrateStockViewProps {
  crateTypes: CrateTypeColumn[];
  rows: CustomerCrateStockRow[];
  initialSearch: string;
}

function formatLedgerType(changeType: string) {
  if (changeType === "export") return "归还 Export";
  if (changeType === "manual") return "手动 Manual";
  return changeType;
}

function qtyClass(qty: number) {
  return qty < 0 ? "font-mono text-red-600" : "font-mono";
}

export function CustomerCrateStockView({
  crateTypes,
  rows,
  initialSearch,
}: CustomerCrateStockViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ledgerMap, setLedgerMap] = useState<
    Record<string, CustomerCrateLedgerEntry[]>
  >({});
  const [ledgerLoading, setLedgerLoading] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<CustomerCrateStockRow | null>(null);
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

  async function toggleExpand(shipperId: string) {
    if (expandedId === shipperId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(shipperId);
    if (!ledgerMap[shipperId]) {
      setLedgerLoading(shipperId);
      try {
        const entries = await getCustomerCrateLedger(shipperId, 10);
        setLedgerMap((prev) => ({ ...prev, [shipperId]: entries }));
      } finally {
        setLedgerLoading(null);
      }
    }
  }

  function openEdit(row: CustomerCrateStockRow) {
    setError(null);
    setEditRow(row);
    const qty: Record<string, string> = {};
    for (const crateType of crateTypes) {
      qty[crateType.id] = String(row.quantities[crateType.id] ?? 0);
    }
    setEditQty(qty);
    setEditNotes("");
  }

  function handleSaveEdit() {
    if (!editRow) return;
    setError(null);
    startTransition(async () => {
      try {
        for (const crateType of crateTypes) {
          const nextQty = parseInt(editQty[crateType.id] ?? "0", 10);
          if (Number.isNaN(nextQty)) {
            throw new Error(`桶型 ${crateType.code} 数量无效 Invalid quantity`);
          }
          const prevQty = editRow.quantities[crateType.id] ?? 0;
          if (nextQty !== prevQty) {
            await updateCustomerCrateStock(
              editRow.shipperId,
              crateType.id,
              nextQty,
              editNotes || undefined
            );
          }
        }
        setEditRow(null);
        router.refresh();
        if (expandedId === editRow.shipperId) {
          const entries = await getCustomerCrateLedger(editRow.shipperId, 10);
          setLedgerMap((prev) => ({
            ...prev,
            [editRow.shipperId]: entries,
          }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败 Save failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-haidee-border bg-white p-4">
        <div className="min-w-[240px] flex-1 space-y-1">
          <label className="text-xs font-medium text-haidee-muted">
            搜索寄货人 Search shipper
          </label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            placeholder="名称或编号…"
            className="min-h-[44px]"
          />
        </div>
        <Button
          onClick={applySearch}
          disabled={isPending}
          className="min-h-[44px]"
        >
          搜索 Search
        </Button>
      </div>

      <p className="text-xs text-haidee-muted">
        欠桶（负数）以红色显示 · 点击行首展开最近 10 条流水
      </p>

      <div className="overflow-x-auto rounded-xl border border-haidee-border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead className="w-8" />
              <TableHead>寄货人 Shipper</TableHead>
              {crateTypes.map((ct) => (
                <TableHead key={ct.id} className="text-right font-mono text-xs">
                  {ct.code}
                </TableHead>
              ))}
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={crateTypes.length + 3}
                  className="py-8 text-center text-haidee-muted"
                >
                  无匹配寄货人 No shippers found
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
                          aria-label="展开流水 Expand ledger"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-medium">{row.shipperName}</TableCell>
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
                          aria-label="编辑 Edit"
                          disabled={isPending}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={crateTypes.length + 3} className="bg-haidee-surface/50 p-0">
                          <div className="px-4 py-3">
                            <p className="mb-2 text-xs font-semibold text-haidee-muted">
                              最近流水 Recent ledger (10)
                            </p>
                            {ledgerLoading === row.shipperId ? (
                              <p className="text-sm text-haidee-muted">加载中…</p>
                            ) : (ledgerMap[row.shipperId]?.length ?? 0) === 0 ? (
                              <p className="text-sm text-haidee-muted">暂无流水 No entries</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs text-haidee-muted">
                                    <th className="pb-1 pr-4">时间 Time</th>
                                    <th className="pb-1 pr-4">桶型 Crate</th>
                                    <th className="pb-1 pr-4">类型 Type</th>
                                    <th className="pb-1 pr-4 text-right">变动 Δ</th>
                                    <th className="pb-1 pr-4 text-right">余额 Bal.</th>
                                    <th className="pb-1">备注 Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ledgerMap[row.shipperId]?.map((entry) => (
                                    <tr
                                      key={entry.id}
                                      className="border-t border-haidee-border/50"
                                    >
                                      <td className="py-1.5 pr-4 font-mono text-xs">
                                        {new Date(entry.createdAt).toLocaleString(
                                          "en-GB",
                                          {
                                            day: "2-digit",
                                            month: "2-digit",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          }
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-4 font-mono">
                                        {entry.crateTypeCode}
                                      </td>
                                      <td className="py-1.5 pr-4">
                                        {formatLedgerType(entry.changeType)}
                                      </td>
                                      <td
                                        className={cn(
                                          "py-1.5 pr-4 text-right font-mono",
                                          entry.quantity < 0 && "text-red-600"
                                        )}
                                      >
                                        {entry.quantity > 0
                                          ? `+${entry.quantity}`
                                          : entry.quantity}
                                      </td>
                                      <td
                                        className={cn(
                                          "py-1.5 pr-4 text-right font-mono",
                                          entry.balance < 0 && "text-red-600"
                                        )}
                                      >
                                        {entry.balance}
                                      </td>
                                      <td className="py-1.5 text-haidee-muted">
                                        {entry.notes ?? "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
      </div>

      <Dialog
        open={editRow !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setEditRow(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              编辑库存 Edit Stock — {editRow?.shipperName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {crateTypes.map((ct) => (
              <div
                key={ct.id}
                className="flex items-center justify-between gap-4"
              >
                <label className="min-w-[80px] font-mono text-sm">{ct.code}</label>
                <Input
                  type="number"
                  value={editQty[ct.id] ?? "0"}
                  onChange={(e) =>
                    setEditQty((prev) => ({
                      ...prev,
                      [ct.id]: e.target.value,
                    }))
                  }
                  className="max-w-[140px] font-mono"
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs font-medium text-haidee-muted">
                备注 Notes
              </label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="可选 Optional"
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
              取消 Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? "保存中…" : "保存 Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

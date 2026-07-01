"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  getMonthlyInvoiceExtraCharges,
  saveMonthlyInvoiceExtraCharges,
} from "@/app/actions/monthly-invoice-extra-charges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MonthlyInvoiceMode } from "@/lib/constants/monthly-invoice";

interface ExtraChargeDraft {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
}

interface MonthlyInvoiceExtraChargesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  mode: MonthlyInvoiceMode;
  customerId: string;
  customerName: string;
  customerCode: string;
  currency: string;
}

function emptyDraft(): ExtraChargeDraft {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: "",
    unit: "",
    unitPrice: "",
    amount: "",
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function computeAmountFromDraft(draft: ExtraChargeDraft): string {
  const qty = Number(draft.quantity);
  const unitPrice = Number(draft.unitPrice);
  if (
    draft.quantity.trim() &&
    draft.unitPrice.trim() &&
    Number.isFinite(qty) &&
    Number.isFinite(unitPrice) &&
    qty > 0 &&
    unitPrice > 0
  ) {
    return String(roundMoney(qty * unitPrice));
  }
  return draft.amount;
}

function draftsFromSaved(
  rows: Array<{
    description: string;
    quantity: number | null;
    unit: string | null;
    unitPrice: number | null;
    amount: number;
  }>
): ExtraChargeDraft[] {
  if (rows.length === 0) return [emptyDraft()];
  return rows.map((row) => ({
    key: crypto.randomUUID(),
    description: row.description,
    quantity: row.quantity != null ? String(row.quantity) : "",
    unit: row.unit ?? "",
    unitPrice: row.unitPrice != null ? String(row.unitPrice) : "",
    amount: String(row.amount),
  }));
}

export function MonthlyInvoiceExtraChargesDialog({
  open,
  onOpenChange,
  year,
  month,
  mode,
  customerId,
  customerName,
  customerCode,
  currency,
}: MonthlyInvoiceExtraChargesDialogProps) {
  const [items, setItems] = useState<ExtraChargeDraft[]>([emptyDraft()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getMonthlyInvoiceExtraCharges({
        year,
        month,
        mode,
        customerId,
      });
      setItems(draftsFromSaved(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败 Load failed");
      setItems([emptyDraft()]);
    } finally {
      setLoading(false);
    }
  }, [year, month, mode, customerId]);

  useEffect(() => {
    if (open) {
      void loadItems();
    }
  }, [open, loadItems]);

  function updateItem(key: string, patch: Partial<ExtraChargeDraft>) {
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        const derivedAmount = computeAmountFromDraft(next);
        if (
          next.quantity.trim() &&
          next.unitPrice.trim() &&
          derivedAmount !== next.amount
        ) {
          next.amount = derivedAmount;
        }
        return next;
      })
    );
  }

  function handleSave() {
    setError(null);
    const payload = items
      .map((item) => {
        const quantity = item.quantity.trim() ? Number(item.quantity) : null;
        const unitPrice = item.unitPrice.trim() ? Number(item.unitPrice) : null;
        const unit = item.unit.trim() || null;
        const amount = Number(computeAmountFromDraft(item));
        return {
          description: item.description.trim(),
          quantity,
          unit,
          unitPrice,
          amount,
        };
      })
      .filter((item) => item.description || item.amount);

    startTransition(async () => {
      try {
        await saveMonthlyInvoiceExtraCharges({
          year,
          month,
          mode,
          customerId,
          items: payload,
        });
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败 Save failed");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>额外收费 Extra Charges</DialogTitle>
          <DialogDescription>
            {customerName} ({customerCode}) · {year}年{month}月 · Mode {mode} ·{" "}
            {currency}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-haidee-muted">加载中 Loading…</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.key} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(item.key, { description: e.target.value })
                    }
                    placeholder="说明 Description *"
                    className="min-h-[44px] min-w-[180px] flex-1"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) =>
                        prev.length <= 1
                          ? prev
                          : prev.filter((row) => row.key !== item.key)
                      )
                    }
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-haidee-muted hover:text-haidee-red"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.key, { quantity: e.target.value })
                    }
                    placeholder="数量 Qty"
                    className="min-h-[44px] w-24 font-mono"
                  />
                  <Input
                    value={item.unit}
                    onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                    placeholder="单位 UOM"
                    className="min-h-[44px] w-24"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(item.key, { unitPrice: e.target.value })
                    }
                    placeholder="单价 U-Price"
                    className="min-h-[44px] w-28 font-mono"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.amount}
                    onChange={(e) =>
                      updateItem(item.key, { amount: e.target.value })
                    }
                    placeholder="金额 Total *"
                    className="min-h-[44px] w-28 font-mono"
                  />
                  <span className="text-xs text-haidee-muted">{currency}</span>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setItems((prev) => [...prev, emptyDraft()])}
              className="min-h-[44px]"
            >
              <Plus className="mr-2 h-4 w-4" />
              添加一行 Add row
            </Button>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-haidee-red">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px]"
          >
            取消 Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || isPending}
            className="min-h-[44px] bg-haidee-blue text-white hover:bg-haidee-blue/90"
          >
            {isPending ? "保存中…" : "保存 Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteSubCustomerChannel,
  saveSubCustomerChannel,
  type SubCustomerChannelAdminRow,
} from "@/app/actions/sub-customer-channels";
import type { SubCustomerChannelOwnerType } from "@/lib/sub-customer-channel";

interface ParentOption {
  id: string;
  code: string;
  name: string;
  isMultiOriginCustomer: boolean;
}

interface OwnerOptions {
  agents: { id: string; code: string; name: string }[];
  pools: { id: string; code: string; name: string }[];
  operational: { id: string; code: string; name: string }[];
}

interface SubCustomerChannelsClientProps {
  rows: SubCustomerChannelAdminRow[];
  parents: ParentOption[];
  owners: OwnerOptions;
}

const EMPTY_FORM = {
  id: "",
  parentShipperId: "",
  channelKey: "",
  label: "",
  ownerType: "self" as SubCustomerChannelOwnerType,
  ownerShipperId: "",
  allowMultiOrigin: false,
  sortOrder: 0,
  active: true,
};

export function SubCustomerChannelsClient({
  rows,
  parents,
  owners,
}: SubCustomerChannelsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const parentById = useMemo(
    () => new Map(parents.map((p) => [p.id, p])),
    [parents]
  );

  const ownerChoices = useMemo(() => {
    if (form.ownerType === "agent") return owners.agents;
    if (form.ownerType === "pool") return owners.pools;
    return owners.operational;
  }, [form.ownerType, owners]);

  function openCreate() {
    setError(null);
    setForm({
      ...EMPTY_FORM,
      parentShipperId: parents[0]?.id ?? "",
      ownerShipperId: parents[0]?.id ?? "",
    });
    setOpen(true);
  }

  function openEdit(row: SubCustomerChannelAdminRow) {
    setError(null);
    setForm({
      id: row.id,
      parentShipperId: row.parentShipperId,
      channelKey: row.channelKey,
      label: row.label,
      ownerType: row.ownerType,
      ownerShipperId: row.ownerShipperId,
      allowMultiOrigin: row.allowMultiOrigin,
      sortOrder: row.sortOrder,
      active: row.active,
    });
    setOpen(true);
  }

  function handleOwnerTypeChange(ownerType: SubCustomerChannelOwnerType) {
    const parent = parentById.get(form.parentShipperId);
    setForm((prev) => ({
      ...prev,
      ownerType,
      ownerShipperId:
        ownerType === "self"
          ? prev.parentShipperId
          : ownerType === "agent"
            ? owners.agents[0]?.id ?? ""
            : owners.pools[0]?.id ?? "",
      allowMultiOrigin:
        ownerType === "self" ? Boolean(parent?.isMultiOriginCustomer) : false,
    }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveSubCustomerChannel({
          ...form,
          id: form.id || undefined,
          ownerShipperId:
            form.ownerType === "self"
              ? form.parentShipperId
              : form.ownerShipperId,
        });
        setOpen(false);
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  function handleDelete(id: string) {
    if (!window.confirm("删除此子顾客渠道？Delete this sub-customer channel?")) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteSubCustomerChannel(id);
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "删除失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-haidee-muted">
          母顾客拆子渠道：进货账单仍归母顾客，桶账按渠道归属。
        </p>
        <div className="flex gap-2">
          <Link
            href="/settings?section=shippers"
            className={buttonVariants({ variant: "outline" })}
          >
            返回设置
          </Link>
          <Button type="button" onClick={openCreate} disabled={isPending}>
            <Plus className="mr-1 h-4 w-4" />
            新增渠道
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-haidee-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>母顾客</TableHead>
              <TableHead>渠道键</TableHead>
              <TableHead>显示名</TableHead>
              <TableHead>归属</TableHead>
              <TableHead>归属主体</TableHead>
              <TableHead>多产地</TableHead>
              <TableHead>排序</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {row.parentShipperName}
                  <span className="ml-1 font-mono text-xs text-haidee-muted">
                    {row.parentShipperCode}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{row.channelKey}</TableCell>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.ownerType}</TableCell>
                <TableCell>
                  {row.ownerShipperName}
                  <span className="ml-1 font-mono text-xs text-haidee-muted">
                    {row.ownerShipperCode}
                  </span>
                </TableCell>
                <TableCell>{row.allowMultiOrigin ? "是" : "—"}</TableCell>
                <TableCell>{row.sortOrder}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(row)}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(row.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-haidee-muted">
                  暂无配置
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "编辑子顾客渠道" : "新增子顾客渠道"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="space-y-1 text-sm">
              <span>母顾客</span>
              <select
                value={form.parentShipperId}
                onChange={(e) => {
                  const parentShipperId = e.target.value;
                  const parent = parentById.get(parentShipperId);
                  setForm((prev) => ({
                    ...prev,
                    parentShipperId,
                    ownerShipperId:
                      prev.ownerType === "self"
                        ? parentShipperId
                        : prev.ownerShipperId,
                    allowMultiOrigin:
                      prev.ownerType === "self"
                        ? Boolean(parent?.isMultiOriginCustomer)
                        : false,
                  }));
                }}
                className="min-h-[40px] w-full rounded-lg border px-3"
              >
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>渠道键 channelKey</span>
              <Input
                value={form.channelKey}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, channelKey: e.target.value }))
                }
                placeholder="self / ranong / songkhla"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>显示名 label</span>
              <Input
                value={form.label}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, label: e.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>归属 ownerType</span>
              <select
                value={form.ownerType}
                onChange={(e) =>
                  handleOwnerTypeChange(
                    e.target.value as SubCustomerChannelOwnerType
                  )
                }
                className="min-h-[40px] w-full rounded-lg border px-3"
              >
                <option value="self">self 母顾客自己</option>
                <option value="agent">agent 代理</option>
                <option value="pool">pool 池</option>
              </select>
            </label>
            {form.ownerType !== "self" ? (
              <label className="space-y-1 text-sm">
                <span>归属主体</span>
                <select
                  value={form.ownerShipperId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      ownerShipperId: e.target.value,
                    }))
                  }
                  className="min-h-[40px] w-full rounded-lg border px-3"
                >
                  {ownerChoices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.code})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {form.ownerType === "self" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allowMultiOrigin}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      allowMultiOrigin: e.target.checked,
                    }))
                  }
                />
                可多产地 allowMultiOrigin
              </label>
            ) : null}
            <label className="space-y-1 text-sm">
              <span>排序 sortOrder</span>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    sortOrder: Number(e.target.value) || 0,
                  }))
                }
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="button" onClick={handleSave} disabled={isPending}>
                保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

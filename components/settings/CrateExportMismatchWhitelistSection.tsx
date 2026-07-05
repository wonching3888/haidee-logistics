"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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
import {
  deleteCrateExportMismatchWhitelistEntry,
  saveCrateExportMismatchWhitelistEntry,
} from "@/app/actions/crate-export-mismatch-whitelist";
import type { CrateExportMismatchWhitelistRow } from "@/lib/crate-export-mismatch-whitelist-service";

type ShipperOption = {
  id: string;
  code: string;
  name: string;
};

interface CrateExportMismatchWhitelistSectionProps {
  entries: CrateExportMismatchWhitelistRow[];
  shippers: ShipperOption[];
}

export function CrateExportMismatchWhitelistSection({
  entries: initialEntries,
  shippers,
}: CrateExportMismatchWhitelistSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shipperId, setShipperId] = useState("");
  const [note, setNote] = useState("");

  const whitelistedIds = new Set(initialEntries.map((e) => e.shipperId));
  const addableShippers = shippers.filter((s) => !whitelistedIds.has(s.id));

  function runAction(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setShipperId("");
        setNote("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-haidee-border bg-white p-4">
      <div>
        <h3 className="text-lg font-semibold text-haidee-text">
          归还桶建议/实际高亮白名单
        </h3>
        <p className="text-sm text-haidee-muted">
          Mismatch highlight whitelist — listed shippers skip orange row
          highlighting on the crate export list even when suggested ≠ actual.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-haidee-red/30 bg-haidee-red/10 px-3 py-2 text-sm text-haidee-red">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm">
          <span className="text-haidee-muted">寄货人 Shipper</span>
          <select
            value={shipperId}
            onChange={(e) => setShipperId(e.target.value)}
            className="min-h-[44px] rounded-lg border border-haidee-border px-3"
          >
            <option value="">选择…</option>
            {addableShippers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
          <span className="text-haidee-muted">备注 Note (optional)</span>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. VIO full-truck policy"
            className="min-h-[44px]"
          />
        </label>
        <Button
          type="button"
          disabled={!shipperId || isPending}
          onClick={() =>
            runAction(() =>
              saveCrateExportMismatchWhitelistEntry({ shipperId, note })
            )
          }
        >
          添加 Add
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>代码</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>备注</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialEntries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-haidee-muted">
                暂无白名单条目
              </TableCell>
            </TableRow>
          ) : (
            initialEntries.map((entry) => (
              <TableRow key={entry.shipperId}>
                <TableCell className="font-mono">{entry.shipperCode}</TableCell>
                <TableCell>{entry.shipperName}</TableCell>
                <TableCell className="text-haidee-muted">
                  {entry.note ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      runAction(() =>
                        deleteCrateExportMismatchWhitelistEntry(entry.shipperId)
                      )
                    }
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    移除
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

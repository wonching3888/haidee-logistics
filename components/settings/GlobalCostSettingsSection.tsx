"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { saveGlobalCostSettings } from "@/app/actions/global-cost-settings";
import {
  GLOBAL_COST_UI_LABELS,
  GLOBAL_TRIP_COST_SETTING_KEYS,
} from "@/lib/constants/global-cost-settings";
import type { GlobalCostSettingRow } from "@/lib/global-cost-settings-service";

interface GlobalCostSettingsSectionProps {
  settings: GlobalCostSettingRow[];
  title?: string;
  tripCostsOnly?: boolean;
}

export function GlobalCostSettingsSection({
  settings: initialSettings,
  title = "全局费用 Global Trip Costs",
  tripCostsOnly = true,
}: GlobalCostSettingsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(initialSettings.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [valueForm, setValueForm] = useState<Record<string, string>>({});

  const visibleSettings = useMemo(() => {
    if (!tripCostsOnly) return settings;
    const allowed = new Set<string>(GLOBAL_TRIP_COST_SETTING_KEYS);
    return settings.filter((row) => allowed.has(row.key));
  }, [settings, tripCostsOnly]);

  useEffect(() => {
    setSettings(initialSettings);
    setLoading(initialSettings.length === 0);
  }, [initialSettings]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      try {
        const response = await fetch("/api/settings/global-costs");
        if (!response.ok) {
          throw new Error("无法加载全局费用 Failed to load global trip costs");
        }
        const data = (await response.json()) as {
          settings?: GlobalCostSettingRow[];
        };
        if (!cancelled && Array.isArray(data.settings)) {
          setSettings(data.settings);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setValueForm(
      Object.fromEntries(
        visibleSettings.map((row) => [row.key, String(row.valueMyr)])
      )
    );
    setSuccess(null);
  }, [visibleSettings]);

  function parseValue(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} 不能为负数`);
    }
    return parsed;
  }

  function runSave() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await saveGlobalCostSettings({
          settings: visibleSettings.map((row) => ({
            key: row.key,
            valueMyr: parseValue(
              valueForm[row.key] ?? "",
              GLOBAL_COST_UI_LABELS[row.key].label
            ),
          })),
        });
        setSuccess("全局费用已保存 Global trip costs saved.");
        const refreshed = await fetch("/api/settings/global-costs");
        if (refreshed.ok) {
          const data = (await refreshed.json()) as {
            settings?: GlobalCostSettingRow[];
          };
          if (Array.isArray(data.settings)) {
            setSettings(data.settings);
          }
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div className="rounded-lg border border-haidee-border bg-white p-4">
      <h3 className="mb-3 text-base font-semibold text-haidee-text">{title}</h3>

      {loading && (
        <p className="mb-3 text-sm text-haidee-muted">加载全局费用中…</p>
      )}

      {!loading && visibleSettings.length === 0 && (
        <p className="mb-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          全局费用表尚未创建。请运行{" "}
          <code className="font-mono">scripts/create-global-cost-settings.ts</code>{" "}
          完成建表，然后刷新本页。
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-4 py-3 text-sm text-haidee-red">
          {error}
        </p>
      )}

      {success && (
        <p className="mb-3 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-haidee-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-haidee-surface hover:bg-haidee-surface">
              <TableHead>费用项目</TableHead>
              <TableHead>金额 (MYR)</TableHead>
              <TableHead>备注</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleSettings.map((row) => {
              const ui = GLOBAL_COST_UI_LABELS[row.key];
              return (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{ui.label}</TableCell>
                  <TableCell>
                    <Input
                      value={valueForm[row.key] ?? ""}
                      onChange={(e) =>
                        setValueForm({
                          ...valueForm,
                          [row.key]: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      className="min-h-[44px] w-[120px] font-mono"
                    />
                  </TableCell>
                  <TableCell className="text-sm text-haidee-muted">
                    {ui.notes}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          className="bg-haidee-blue text-white"
          disabled={isPending}
          onClick={runSave}
        >
          保存 Save
        </Button>
      </div>
    </div>
  );
}

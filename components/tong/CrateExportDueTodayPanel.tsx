"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "@/components/shared/locale-context";
import { formatDisplay } from "@/lib/date-utils";
import type {
  CrateExportDueItem,
  CrateExportDueTodayData,
  CrateExportPrefillTarget,
  CrateQtyByCode,
} from "@/lib/crate-export-due-today";
import { cn } from "@/lib/utils";

interface CrateExportDueTodayPanelProps {
  data: CrateExportDueTodayData;
  onSelect: (prefill: CrateExportPrefillTarget) => void;
}

function formatQtySummary(map: CrateQtyByCode): string {
  const entries = Object.entries(map);
  if (entries.length === 0) return "—";
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, qty]) => `${code} ${qty}`)
    .join(" / ");
}

function QtyCell({
  value,
  owed,
}: {
  value: CrateQtyByCode;
  owed?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-mono text-sm",
        owed ? "font-semibold text-haidee-red" : "text-haidee-text"
      )}
    >
      {formatQtySummary(value)}
    </span>
  );
}

export function CrateExportDueTodayPanel({
  data,
  onSelect,
}: CrateExportDueTodayPanelProps) {
  const { t } = useT();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  function toggleExpand(key: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderRow(
    key: string,
    label: string,
    due: CrateQtyByCode,
    returned: CrateQtyByCode,
    owed: CrateQtyByCode,
    prefill: CrateExportPrefillTarget,
    opts?: { indent?: boolean; badge?: string }
  ) {
    return (
      <tr
        key={key}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(prefill)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(prefill);
          }
        }}
        className={cn(
          "cursor-pointer border-b border-haidee-border/60 transition-colors hover:bg-haidee-surface/80",
          opts?.indent && "bg-haidee-surface/30"
        )}
      >
        <td className="px-4 py-3">
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 font-medium text-haidee-text",
              opts?.indent && "pl-8"
            )}
          >
            {label}
            {opts?.badge ? (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                {opts.badge}
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <QtyCell value={due} />
        </td>
        <td className="px-4 py-3 text-right">
          <QtyCell value={returned} />
        </td>
        <td className="px-4 py-3 text-right">
          <QtyCell value={owed} owed />
        </td>
      </tr>
    );
  }

  function renderGroup(item: CrateExportDueItem) {
    if (item.kind === "row") {
      const { row } = item;
      return renderRow(
        row.key,
        row.label,
        row.due,
        row.returned,
        row.owed,
        row.prefill
      );
    }

    const group = item.kind === "agent" ? item.group : item.group;
    const isExpanded = expandedKeys.has(group.key);
    const badge =
      item.kind === "agent"
        ? t("crateExport.dueTodayAgentBadge")
        : t("crateExport.dueTodayPoolBadge");

    return (
      <Fragment key={group.key}>
        <tr
          role="button"
          tabIndex={0}
          onClick={() => onSelect(group.prefill)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(group.prefill);
            }
          }}
          className="cursor-pointer border-b border-haidee-border/60 bg-amber-50/40 transition-colors hover:bg-amber-50/70"
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => toggleExpand(group.key, e)}
                className="flex min-h-[32px] min-w-[32px] shrink-0 items-center justify-center text-haidee-muted hover:text-haidee-text"
                aria-label={t("crateExport.dueTodayExpandMembers")}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              <div className="flex flex-wrap items-center gap-2 font-medium text-haidee-text">
                {item.kind === "agent" ? item.group.agentName : item.group.poolName}
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                  {badge}
                </span>
              </div>
            </div>
          </td>
          <td className="px-4 py-3 text-right">
            <QtyCell value={group.due} />
          </td>
          <td className="px-4 py-3 text-right">
            <QtyCell value={group.returned} />
          </td>
          <td className="px-4 py-3 text-right">
            <QtyCell value={group.owed} owed />
          </td>
        </tr>
        {isExpanded &&
          group.members.map((member) =>
            renderRow(
              member.key,
              member.label,
              member.due,
              member.returned,
              member.owed,
              member.prefill,
              { indent: true }
            )
          )}
      </Fragment>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-haidee-text">
          {t("crateExport.dueTodayTitle")}
        </h3>
        <p className="text-sm text-haidee-muted">
          {t("crateExport.dueTodayHint", { date: formatDisplay(data.date) })}
        </p>
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-haidee-border bg-white p-8 text-center text-sm text-haidee-muted">
          {t("crateExport.dueTodayEmpty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-haidee-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-haidee-border bg-haidee-surface text-haidee-muted">
                <th className="px-4 py-3 text-left">
                  {t("common.consignor")}
                </th>
                <th className="px-4 py-3 text-right">
                  {t("crateExport.dueTodayDue")}
                </th>
                <th className="px-4 py-3 text-right">
                  {t("crateExport.dueTodayReturned")}
                </th>
                <th className="px-4 py-3 text-right">
                  {t("crateExport.dueTodayOwed")}
                </th>
              </tr>
            </thead>
            <tbody>{data.items.map(renderGroup)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

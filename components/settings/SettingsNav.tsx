"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsSection =
  | "shippers"
  | "stalls"
  | "defaults"
  | "trucks"
  | "users"
  | "shipper-rates"
  | "consignee-rates"
  | "payment-relations"
  | "exchange-rate";

const FREIGHT_SECTIONS: SettingsSection[] = [
  "shipper-rates",
  "consignee-rates",
  "payment-relations",
];

function isFreightSection(section: SettingsSection) {
  return FREIGHT_SECTIONS.includes(section);
}

const TOP_LEVEL_ITEMS: {
  id: SettingsSection;
  label: string;
  labelEn: string;
}[] = [
  { id: "shippers", label: "寄货人", labelEn: "Shippers" },
  { id: "stalls", label: "档口", labelEn: "Stalls" },
  { id: "defaults", label: "档口对应", labelEn: "Defaults" },
  { id: "trucks", label: "车辆", labelEn: "Trucks" },
  { id: "users", label: "用户", labelEn: "Users" },
];

const FREIGHT_CHILD_ITEMS: {
  id: SettingsSection;
  label: string;
  labelEn: string;
}[] = [
  { id: "shipper-rates", label: "寄货人费率", labelEn: "Shipper Rates" },
  { id: "consignee-rates", label: "收货人费率", labelEn: "Consignee Rates" },
  {
    id: "payment-relations",
    label: "付款关系",
    labelEn: "Payment Relations",
  },
];

export const SETTINGS_SECTION_TITLES: Record<
  SettingsSection,
  { label: string; labelEn: string }
> = {
  shippers: { label: "寄货人", labelEn: "Shippers" },
  stalls: { label: "档口", labelEn: "Stalls" },
  defaults: { label: "档口对应", labelEn: "Defaults" },
  trucks: { label: "车辆", labelEn: "Trucks" },
  users: { label: "用户", labelEn: "Users" },
  "shipper-rates": { label: "寄货人费率", labelEn: "Shipper Rates" },
  "consignee-rates": { label: "收货人费率", labelEn: "Consignee Rates" },
  "payment-relations": { label: "付款关系", labelEn: "Payment Relations" },
  "exchange-rate": { label: "汇率设定", labelEn: "Exchange Rate" },
};

interface SettingsNavProps {
  active: SettingsSection;
  onChange: (section: SettingsSection) => void;
}

function NavButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
        active
          ? "bg-haidee-blue/10 font-medium text-haidee-blue"
          : "text-haidee-text hover:bg-haidee-surface",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SettingsNav({ active, onChange }: SettingsNavProps) {
  const [freightOpen, setFreightOpen] = useState(isFreightSection(active));

  useEffect(() => {
    if (isFreightSection(active)) {
      setFreightOpen(true);
    }
  }, [active]);

  const freightGroupActive = isFreightSection(active);

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-haidee-border bg-haidee-surface/40 p-3">
      <div className="space-y-0.5">
        {TOP_LEVEL_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            active={active === item.id}
            onClick={() => onChange(item.id)}
          >
            <span>
              {item.label}{" "}
              <span className="text-xs text-haidee-muted">{item.labelEn}</span>
            </span>
          </NavButton>
        ))}

        <div className="pt-1">
          <NavButton
            active={freightGroupActive}
            onClick={() => {
              setFreightOpen((open) => !open);
              if (!freightOpen && !freightGroupActive) {
                onChange("shipper-rates");
              }
            }}
          >
            <span className="flex flex-1 items-center justify-between gap-2">
              <span>
                车力费率{" "}
                <span className="text-xs text-haidee-muted">Freight Rates</span>
              </span>
              {freightOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-haidee-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-haidee-muted" />
              )}
            </span>
          </NavButton>

          {freightOpen && (
            <div className="ml-3 mt-0.5 space-y-0.5 border-l border-haidee-border pl-2">
              {FREIGHT_CHILD_ITEMS.map((item) => (
                <NavButton
                  key={item.id}
                  active={active === item.id}
                  onClick={() => onChange(item.id)}
                  className="py-2 text-[13px]"
                >
                  <span>
                    {item.label}{" "}
                    <span className="text-xs text-haidee-muted">
                      {item.labelEn}
                    </span>
                  </span>
                </NavButton>
              ))}
            </div>
          )}
        </div>

        <NavButton
          active={active === "exchange-rate"}
          onClick={() => onChange("exchange-rate")}
        >
          <span>
            汇率设定{" "}
            <span className="text-xs text-haidee-muted">Exchange Rate</span>
          </span>
        </NavButton>
      </div>
    </nav>
  );
}

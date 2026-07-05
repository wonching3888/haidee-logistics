"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isSettingsExternalLink,
  isSettingsFreightSubgroup,
  parseSettingsSection,
  SETTINGS_SIDEBAR_GROUPS,
  settingsSectionHref,
  type SettingsFreightSubgroup,
  type SettingsSidebarGroupItem,
} from "@/lib/constants/settings-nav";
import { isPathActive } from "@/lib/constants/main-nav";

interface SettingsSidebarMenuProps {
  onNavigate?: () => void;
}

function SettingsGroupHeading({
  label,
  labelEn,
}: {
  label: string;
  labelEn: string;
}) {
  return (
    <li className="list-none px-3 pb-0.5 pt-2 first:pt-0">
      <p className="text-[10px] font-bold leading-snug text-[#0d1a0d]/55">
        ━ {label}{" "}
        <span className="font-semibold">{labelEn}</span> ━
      </p>
    </li>
  );
}

function FreightRatesSubgroup({
  item,
  settingsSection,
  onNavigate,
}: {
  item: SettingsFreightSubgroup;
  settingsSection: string;
  onNavigate?: () => void;
}) {
  const freightActive = item.children.some(
    (child) => child.section === settingsSection
  );
  const [freightOpen, setFreightOpen] = useState(freightActive);

  useEffect(() => {
    if (freightActive) {
      setFreightOpen(true);
    }
  }, [freightActive]);

  return (
    <li>
      <button
        type="button"
        onClick={() => setFreightOpen((open) => !open)}
        className={cn(
          "flex min-h-[40px] w-full items-center rounded-lg px-3 py-2 text-sm transition-colors",
          freightActive
            ? "bg-[#5A8950] font-bold text-[#FFFFFF]"
            : "font-semibold text-[#0d1a0d] hover:bg-[#5A8950]/25 hover:text-[#0d1a0d]"
        )}
      >
        <span className="flex flex-1 items-center justify-between gap-2 text-left">
          <span>
            {item.label}{" "}
            <span
              className={cn(
                "text-xs",
                freightActive
                  ? "font-bold text-[#FFFFFF]"
                  : "font-semibold text-[#0d1a0d]"
              )}
            >
              {item.labelEn}
            </span>
          </span>
          {freightOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
          )}
        </span>
      </button>

      {freightOpen && (
        <ul className="m-0 mt-1 list-none space-y-1 p-0 pl-3">
          {item.children.map((child) => (
            <li key={child.section}>
              <SettingsSubLink
                href={settingsSectionHref(child.section)}
                label={child.label}
                labelEn={child.labelEn}
                isActive={settingsSection === child.section}
                onNavigate={onNavigate}
                compact
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function SettingsMenuItem({
  item,
  settingsSection,
  pathname,
  onNavigate,
}: {
  item: SettingsSidebarGroupItem;
  settingsSection: string;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  if (isSettingsFreightSubgroup(item)) {
    return (
      <FreightRatesSubgroup
        item={item}
        settingsSection={settingsSection}
        onNavigate={onNavigate}
      />
    );
  }

  if (isSettingsExternalLink(item)) {
    return (
      <li>
        <SettingsSubLink
          href={item.externalHref}
          label={item.label}
          labelEn={item.labelEn}
          isActive={isPathActive(pathname, item.externalHref)}
          onNavigate={onNavigate}
        />
      </li>
    );
  }

  return (
    <li>
      <SettingsSubLink
        href={settingsSectionHref(item.section)}
        label={item.label}
        labelEn={item.labelEn}
        isActive={settingsSection === item.section}
        onNavigate={onNavigate}
      />
    </li>
  );
}

export function SettingsSidebarMenu({ onNavigate }: SettingsSidebarMenuProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settingsSection = parseSettingsSection(searchParams.get("section"));

  return (
    <ul className="m-0 mt-1 list-none space-y-1 p-0 pl-4">
      {SETTINGS_SIDEBAR_GROUPS.map((group) => (
        <li key={group.id} className="list-none">
          <ul className="m-0 list-none space-y-1 p-0">
            <SettingsGroupHeading label={group.label} labelEn={group.labelEn} />
            {group.items.map((item) => (
              <SettingsMenuItem
                key={
                  isSettingsFreightSubgroup(item)
                    ? item.labelEn
                    : isSettingsExternalLink(item)
                      ? item.externalHref
                      : item.section
                }
                item={item}
                settingsSection={settingsSection}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function SettingsSubLink({
  href,
  label,
  labelEn,
  isActive,
  onNavigate,
  compact,
}: {
  href: string;
  label: string;
  labelEn: string;
  isActive: boolean;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center rounded-lg px-3 py-2 text-sm transition-colors",
        compact ? "min-h-[36px]" : "min-h-[40px]",
        isActive
          ? "bg-[#5A8950] font-bold text-[#FFFFFF]"
          : "font-semibold text-[#0d1a0d] hover:bg-[#5A8950]/25 hover:text-[#0d1a0d]"
      )}
    >
      <span>
        {label}{" "}
        <span
          className={cn(
            "text-xs",
            isActive ? "font-bold text-[#FFFFFF]" : "font-semibold text-[#0d1a0d]"
          )}
        >
          {labelEn}
        </span>
      </span>
    </Link>
  );
}

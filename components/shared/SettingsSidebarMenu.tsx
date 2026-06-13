"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isFreightSettingsSection,
  parseSettingsSection,
  SETTINGS_SIDEBAR_MENU,
  settingsSectionHref,
} from "@/lib/constants/settings-nav";

interface SettingsSidebarMenuProps {
  onNavigate?: () => void;
}

export function SettingsSidebarMenu({ onNavigate }: SettingsSidebarMenuProps) {
  const searchParams = useSearchParams();
  const settingsSection = parseSettingsSection(searchParams.get("section"));
  const freightActive = isFreightSettingsSection(settingsSection);
  const [freightOpen, setFreightOpen] = useState(freightActive);

  useEffect(() => {
    if (freightActive) {
      setFreightOpen(true);
    }
  }, [freightActive]);

  return (
    <ul className="m-0 mt-1 list-none space-y-1 p-0 pl-4">
      {SETTINGS_SIDEBAR_MENU.map((item) => {
        if ("children" in item && item.children) {
          const freightGroupActive = item.children.some(
            (child) => child.section === settingsSection
          );

          return (
            <li key={item.labelEn}>
              <button
                type="button"
                onClick={() => setFreightOpen((open) => !open)}
                className={cn(
                  "flex min-h-[40px] w-full items-center rounded-lg px-3 py-2 text-sm transition-colors",
                  freightGroupActive
                    ? "bg-haidee-accent/20 text-haidee-accent"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <span className="flex flex-1 items-center justify-between gap-2 text-left">
                  <span>
                    {item.label}{" "}
                    <span className="text-xs text-white/50">{item.labelEn}</span>
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

        const section = item.section!;
        return (
          <li key={section}>
            <SettingsSubLink
              href={settingsSectionHref(section)}
              label={item.label}
              labelEn={item.labelEn}
              isActive={settingsSection === section}
              onNavigate={onNavigate}
            />
          </li>
        );
      })}
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
          ? "bg-haidee-accent/20 text-haidee-accent"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <span>
        {label} <span className="text-xs text-white/50">{labelEn}</span>
      </span>
    </Link>
  );
}

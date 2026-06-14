import { redirect } from "next/navigation";
import { getSettingsData } from "@/app/actions/settings";
import { getFreightSettingsData } from "@/app/actions/freight-settings";
import { getDriverPayrollSettingsData } from "@/app/actions/driver-payroll";
import { getRouteMasterSettingsData } from "@/app/actions/route-master";
import { getAllowanceSettingsData } from "@/app/actions/allowance-settings";
import { SettingsClient } from "@/components/settings/SettingsClient";
import {
  parseSettingsSection,
  settingsSectionHref,
} from "@/lib/constants/settings-nav";

interface SettingsPageProps {
  searchParams: Promise<{ section?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { section: sectionParam } = await searchParams;

  if (!sectionParam) {
    redirect(settingsSectionHref("shippers"));
  }

  const activeSection = parseSettingsSection(sectionParam);
  const [data, freightData, driverPayrollDrivers, routeMasters, allowanceSettings] =
    await Promise.all([
    getSettingsData(),
    getFreightSettingsData(),
    activeSection === "driver-payroll"
      ? getDriverPayrollSettingsData()
      : Promise.resolve([]),
    activeSection === "routes"
      ? getRouteMasterSettingsData()
      : Promise.resolve([]),
    activeSection === "allowance-settings"
      ? getAllowanceSettingsData()
      : Promise.resolve(null),
  ]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          系统设置 System Settings
        </h2>
        <p className="text-sm text-haidee-muted">
          主数据管理 Master data management（仅管理员）
        </p>
      </div>
      <SettingsClient
        activeSection={activeSection}
        data={data}
        freightData={freightData}
        driverPayrollDrivers={driverPayrollDrivers}
        routeMasters={routeMasters}
        allowanceSettings={allowanceSettings}
      />
    </div>
  );
}

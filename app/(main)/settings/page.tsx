import { redirect } from "next/navigation";
import { getSettingsData } from "@/app/actions/settings";
import { getFreightSettingsData } from "@/app/actions/freight-settings";
import { getDriverPayrollSettingsData } from "@/app/actions/driver-payroll";
import { getStaffPayrollSettingsData } from "@/app/actions/staff-payroll";
import { getRouteMasterSettingsData } from "@/app/actions/route-master";
import { getAllowanceSettingsData } from "@/app/actions/allowance-settings";
import { getCrateRentalRates } from "@/app/actions/crate-rental-rates";
import { getCrateExportMismatchWhitelistData } from "@/app/actions/crate-export-mismatch-whitelist";
import { SettingsClient } from "@/components/settings/SettingsClient";
import {
  parseSettingsSection,
  resolveSettingsSectionRedirect,
  settingsSectionHref,
} from "@/lib/constants/settings-nav";

export const dynamic = "force-dynamic";

interface SettingsPageProps {
  searchParams: Promise<{ section?: string }>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { section: sectionParam } = await searchParams;

  const legacyRedirect = resolveSettingsSectionRedirect(sectionParam);
  if (legacyRedirect) {
    redirect(settingsSectionHref(legacyRedirect));
  }

  if (!sectionParam) {
    redirect(settingsSectionHref("shippers"));
  }

  const activeSection = parseSettingsSection(sectionParam);
  const [
    data,
    freightData,
    driverPayrollDrivers,
    staffPayrollStaff,
    routeMasters,
    payrollSettings,
    crateRentalRates,
    crateExportMismatchWhitelist,
  ] = await Promise.all([
    getSettingsData(),
    getFreightSettingsData(),
    activeSection === "driver-payroll"
      ? getDriverPayrollSettingsData()
      : Promise.resolve([]),
    activeSection === "staff-payroll"
      ? getStaffPayrollSettingsData()
      : Promise.resolve([]),
    activeSection === "routes"
      ? getRouteMasterSettingsData()
      : Promise.resolve([]),
    activeSection === "payroll-settings"
      ? getAllowanceSettingsData()
      : Promise.resolve(null),
    activeSection === "crate-rental-rates"
      ? getCrateRentalRates()
      : Promise.resolve([]),
    activeSection === "crate-export-settings"
      ? getCrateExportMismatchWhitelistData()
      : Promise.resolve([]),
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
        staffPayrollStaff={staffPayrollStaff}
        routeMasters={routeMasters}
        payrollSettings={payrollSettings}
        crateRentalRates={crateRentalRates}
        crateExportMismatchWhitelist={crateExportMismatchWhitelist}
      />
    </div>
  );
}

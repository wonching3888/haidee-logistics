import { getSettingsData } from "@/app/actions/settings";
import { SettingsClient } from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const data = await getSettingsData();

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
      <SettingsClient data={data} />
    </div>
  );
}

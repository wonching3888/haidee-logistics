import { UnloadingRatesSettings } from "@/components/driver-expenses/UnloadingRatesSettings";

export const dynamic = "force-dynamic";

export default function UnloadingRatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          下货费率 Unloading Rates
        </h2>
        <p className="text-sm text-haidee-muted">
          各市场下货费与 KPB 费率配置（仅管理员）
        </p>
      </div>
      <UnloadingRatesSettings />
    </div>
  );
}

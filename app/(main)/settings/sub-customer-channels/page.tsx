import {
  listOwnerShipperOptionsForSubChannels,
  listParentShipperOptionsForSubChannels,
  listSubCustomerChannelsAdmin,
} from "@/app/actions/sub-customer-channels";
import { SubCustomerChannelsClient } from "@/components/settings/SubCustomerChannelsClient";

export const dynamic = "force-dynamic";

export default async function SubCustomerChannelsPage() {
  const [rows, parents, owners] = await Promise.all([
    listSubCustomerChannelsAdmin(),
    listParentShipperOptionsForSubChannels(),
    listOwnerShipperOptionsForSubChannels(),
  ]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          子顾客渠道 Sub-customer channels
        </h2>
        <p className="text-sm text-haidee-muted">
          配置母顾客的桶归属渠道（账单仍归母顾客）
        </p>
      </div>
      <SubCustomerChannelsClient rows={rows} parents={parents} owners={owners} />
    </div>
  );
}

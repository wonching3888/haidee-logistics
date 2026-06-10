import { getMarkets, getShippers, getTongTypes } from "@/app/actions/inbound";
import { InboundForm } from "@/components/inbound/InboundForm";
import { PageError } from "@/components/shared/PageError";

export default async function NewInboundPage() {
  try {
    const [shippers, tongTypes, markets] = await Promise.all([
      getShippers(),
      getTongTypes(),
      getMarkets(),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            新增进货 New Inbound
          </h2>
          <p className="text-sm text-haidee-muted">
            选择寄货人后自动带出固定档口列表 Select consignor to load default stalls
          </p>
        </div>

        <InboundForm shippers={shippers} tongTypes={tongTypes} markets={markets} />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            新增进货 New Inbound
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}

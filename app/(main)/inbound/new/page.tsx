import { getMarkets, getShippers, getTongTypes } from "@/app/actions/inbound";
import { InboundForm } from "@/components/inbound/InboundForm";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n/translate";

export default async function NewInboundPage() {
  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";

  try {
    const [shippers, tongTypes, markets] = await Promise.all([
      getShippers(),
      getTongTypes(),
      getMarkets(),
    ]);

    return (
      <div className="min-w-0 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {t("inbound.new", locale)}
          </h2>
          <p className="text-sm text-haidee-muted">
            {t("inbound.newSubtitle", locale)}
          </p>
        </div>

        <InboundForm shippers={shippers} tongTypes={tongTypes} markets={markets} />
      </div>
    );
  } catch (error) {
    return (
      <div className="min-w-0 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {t("inbound.new", locale)}
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}

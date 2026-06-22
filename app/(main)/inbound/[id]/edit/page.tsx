import { notFound } from "next/navigation";
import {
  getInboundSession,
  getMarkets,
  getShippers,
  getTongTypes,
} from "@/app/actions/inbound";
import { InboundForm } from "@/components/inbound/InboundForm";
import { PageError } from "@/components/shared/PageError";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n/translate";
import {
  serializeInboundFormInitialSession,
  serializeInboundFreightLines,
  serializeMarketOptions,
  serializeShipperOptions,
  serializeTongTypeOptions,
} from "@/lib/inbound-form-serialize";

export const dynamic = "force-dynamic";

interface EditInboundPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInboundPage({ params }: EditInboundPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  const locale = user?.language ?? "zh";

  try {
    const [session, shippers, tongTypes, markets] = await Promise.all([
      getInboundSession(id),
      getShippers(),
      getTongTypes(),
      getMarkets(),
    ]);

    if (!session) notFound();

    return (
    <div className="min-w-0 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-haidee-text">
          {t("inbound.edit", locale)}
        </h2>
        <p className="text-sm text-haidee-muted">
          {session.sessionNo ? (
            <span className="font-mono">{session.sessionNo}</span>
          ) : (
            t("common.draft", locale)
          )}
          {" · "}
          {session.shipperName}
        </p>
      </div>

      <InboundForm
        shippers={serializeShipperOptions(shippers)}
        tongTypes={serializeTongTypeOptions(tongTypes)}
        markets={serializeMarketOptions(markets)}
        initialSession={serializeInboundFormInitialSession(session)}
        freightLines={
          session.showFreightInfo
            ? serializeInboundFreightLines(session.lines)
            : undefined
        }
      />
    </div>
    );
  } catch (error) {
    return (
      <div className="min-w-0 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-haidee-text">
            {t("inbound.edit", locale)}
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}

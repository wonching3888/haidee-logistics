import { notFound } from "next/navigation";
import {
  getInboundSession,
  getMarkets,
  getShippers,
  getTongTypes,
} from "@/app/actions/inbound";
import { InboundForm } from "@/components/inbound/InboundForm";
import { PageError } from "@/components/shared/PageError";
import {
  serializeInboundFormInitialSession,
  serializeInboundFreightLines,
} from "@/lib/inbound-form-serialize";

export const dynamic = "force-dynamic";

interface EditInboundPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInboundPage({ params }: EditInboundPageProps) {
  const { id } = await params;

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
          编辑进货 Edit Inbound
        </h2>
        <p className="text-sm text-haidee-muted">
          {session.sessionNo ? (
            <span className="font-mono">{session.sessionNo}</span>
          ) : (
            "草稿 Draft"
          )}
          {" · "}
          {session.shipperName}
        </p>
      </div>

      <InboundForm
        shippers={shippers}
        tongTypes={tongTypes}
        markets={markets}
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
            编辑进货 Edit Inbound
          </h2>
        </div>
        <PageError error={error} />
      </div>
    );
  }
}

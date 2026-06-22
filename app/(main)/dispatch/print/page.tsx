import { DOPrintPageWithShare } from "@/components/documents/DOPrintPageWithShare";
import { DispatchKlMcPrint } from "@/components/dispatch/DispatchKlMcPrint";
import { PageError } from "@/components/shared/PageError";
import { getDispatchKlMcPrintData } from "@/app/actions/dispatch";
import { requirePageUser } from "@/lib/auth";
import { resolveDateParam } from "@/lib/date-utils";
import { t } from "@/lib/i18n/translate";

export const dynamic = "force-dynamic";

interface DispatchKlMcPrintPageProps {
  searchParams: Promise<{ date?: string; returnTo?: string }>;
}

function resolveBackHref(returnTo: string | undefined, date: string): string {
  const trimmed = returnTo?.trim();
  if (trimmed?.startsWith("/")) return trimmed;
  return `/dispatch?date=${encodeURIComponent(date)}`;
}

export default async function DispatchKlMcPrintPage({
  searchParams,
}: DispatchKlMcPrintPageProps) {
  const params = await searchParams;
  const date = resolveDateParam(params.date);
  const user = await requirePageUser();
  const locale = user.language;
  const backHref = resolveBackHref(params.returnTo, date);
  const title = `${t("dispatch.klMcPrintTitle", locale)} · ${date}`;
  const documentTitle = `Dispatch-KL-MC-${date}`;

  try {
    const data = await getDispatchKlMcPrintData(date);

    return (
      <DOPrintPageWithShare
        title={title}
        documentTitle={documentTitle}
        backHref={backHref}
        sharePayload={{
          fileName: `${documentTitle}.pdf`,
          title: documentTitle,
          text: title,
        }}
      >
        <DispatchKlMcPrint data={data} locale={locale} />
      </DOPrintPageWithShare>
    );
  } catch (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-haidee-text">{title}</h2>
        <PageError error={error} locale={locale} />
      </div>
    );
  }
}

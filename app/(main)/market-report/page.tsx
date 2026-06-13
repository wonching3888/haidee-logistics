import { redirect } from "next/navigation";

export default async function LegacyMarketReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((part) => query.append(key, part));
    }
  }

  const suffix = query.toString();
  redirect(suffix ? `/reports/market?${suffix}` : "/reports/market");
}

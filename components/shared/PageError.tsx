import { getPageErrorMessage } from "@/lib/page-utils";

interface PageErrorProps {
  error: unknown;
}

export function PageError({ error }: PageErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-haidee-red/30 bg-red-50 px-4 py-3 text-sm text-haidee-red"
    >
      {getPageErrorMessage(error)}
    </div>
  );
}

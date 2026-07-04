/** Yellow banner when P&L is missing cost components. */
export function PnlIncompleteWarning({
  message,
}: {
  message: string | null | undefined;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950"
    >
      {message}
    </div>
  );
}

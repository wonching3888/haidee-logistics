export function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: string }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/** Parse target URL from a Next.js server-action redirect error digest. */
export function getNextRedirectUrl(error: unknown): string | null {
  if (!isNextRedirectError(error)) return null;
  const parts = (error as { digest: string }).digest.split(";");
  return parts[2] ?? null;
}

import type { OperationsPayrollWarningResult } from "@/lib/operations-payroll-warnings";

const CACHE_TTL_MS = 15 * 60 * 1000;

const cache = new Map<
  string,
  { expiresAt: number; value: OperationsPayrollWarningResult }
>();
const inflight = new Map<string, Promise<OperationsPayrollWarningResult>>();

export function operationsPayrollWarningsCacheKey(yearMonth: string) {
  return yearMonth;
}

export function getCachedOperationsPayrollWarnings(
  key: string
): OperationsPayrollWarningResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCachedOperationsPayrollWarnings(
  key: string,
  value: OperationsPayrollWarningResult
) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function getInflightOperationsPayrollWarnings(key: string) {
  return inflight.get(key);
}

export function setInflightOperationsPayrollWarnings(
  key: string,
  promise: Promise<OperationsPayrollWarningResult>
) {
  inflight.set(key, promise);
  void promise.finally(() => {
    if (inflight.get(key) === promise) {
      inflight.delete(key);
    }
  });
}

/** Test helper */
export function clearOperationsPayrollWarningsCache() {
  cache.clear();
  inflight.clear();
}

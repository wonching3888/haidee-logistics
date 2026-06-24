import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";

const DB_RETRY_DELAY_MS = 150;

const RETRIABLE_PRISMA_CODES = new Set(["P1001", "P1017", "P2024"]);

const NON_RETRIABLE_PRISMA_CODES = new Set(["P2002", "P2003", "P2025"]);

const RETRIABLE_PG_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "EPIPE", "57P01"]);

const RETRIABLE_MESSAGE_FRAGMENTS = ["Connection terminated unexpectedly"];

function collectErrorChain(err: unknown): unknown[] {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err;

  while (current != null && !seen.has(current)) {
    seen.add(current);
    chain.push(current);

    if (typeof current === "object" && "cause" in current) {
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }

  return chain;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function getErrorCode(err: unknown): string | undefined {
  if (err instanceof PrismaClientKnownRequestError) return err.code;
  if (typeof err === "object" && err != null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function isRetriableErrorNode(err: unknown): boolean {
  if (err instanceof PrismaClientKnownRequestError) {
    if (NON_RETRIABLE_PRISMA_CODES.has(err.code)) return false;
    if (RETRIABLE_PRISMA_CODES.has(err.code)) return true;
  }

  const code = getErrorCode(err);
  if (code != null) {
    if (NON_RETRIABLE_PRISMA_CODES.has(code)) return false;
    if (RETRIABLE_PRISMA_CODES.has(code)) return true;
    if (RETRIABLE_PG_CODES.has(code)) return true;
  }

  const message = getErrorMessage(err);
  return RETRIABLE_MESSAGE_FRAGMENTS.some((fragment) => message.includes(fragment));
}

/** Whitelist-only: transient connection failures, never business/constraint errors. */
export function isRetriableDbConnectionError(err: unknown): boolean {
  const chain = collectErrorChain(err);

  for (const node of chain) {
    if (node instanceof PrismaClientKnownRequestError) {
      if (NON_RETRIABLE_PRISMA_CODES.has(node.code)) return false;
    } else {
      const code = getErrorCode(node);
      if (code != null && NON_RETRIABLE_PRISMA_CODES.has(code)) return false;
    }
  }

  return chain.some(isRetriableErrorNode);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type DbRetryOptions = {
  label?: string;
  maxRetries?: number;
};

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  options: DbRetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const canRetry = attempt < maxRetries && isRetriableDbConnectionError(err);
      if (!canRetry) throw err;

      console.warn("[db-retry]", {
        label: options.label,
        attempt: attempt + 1,
        code: getErrorCode(err),
        message: getErrorMessage(err),
      });

      await sleep(DB_RETRY_DELAY_MS);
    }
  }

  throw new Error("withDbRetry: unreachable");
}

export const READ_DB_OPERATIONS = new Set([
  "findUnique",
  "findFirst",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

export function isReadDbOperation(operation: string): boolean {
  return READ_DB_OPERATIONS.has(operation);
}

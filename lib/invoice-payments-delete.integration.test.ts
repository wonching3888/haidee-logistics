/**
 * Integration test for deleteInvoicePayment audit trail.
 *
 * SAFETY: never runs against .env.local / production DATABASE_URL.
 * Requires both:
 *   RUN_INTEGRATION=1
 *   TEST_DATABASE_URL=<dedicated postgres, not production>
 *
 * Example:
 *   RUN_INTEGRATION=1 TEST_DATABASE_URL="postgresql://..." \
 *     npx vitest run lib/invoice-payments-delete.integration.test.ts
 */
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { AppUser } from "@/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === "1";
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim() ?? "";

/** Refuse known production Supabase host even if someone points TEST_DATABASE_URL at it. */
const BLOCKED_DB_HOST_SNIPPETS = [
  "zlmkfqicezpjpzgqljnj.supabase.co",
  "db.zlmkfqicezpjpzgqljnj",
];

function assertSafeTestDatabaseUrl(url: string) {
  const lower = url.toLowerCase();
  for (const snippet of BLOCKED_DB_HOST_SNIPPETS) {
    if (lower.includes(snippet)) {
      throw new Error(
        `TEST_DATABASE_URL points at blocked production host (${snippet}). Refusing to run.`
      );
    }
  }
}

let canRun = false;

// Pin DB URL before any prisma import. Clear singleton so we never reuse a
// client that was constructed against .env.local from vitest.setup.ts.
if (RUN_INTEGRATION && TEST_DATABASE_URL.length > 0) {
  // Loud failure if someone points TEST_DATABASE_URL at production.
  assertSafeTestDatabaseUrl(TEST_DATABASE_URL);
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  delete (globalThis as { prisma?: unknown }).prisma;
  canRun = true;
}

const describeIntegration = canRun ? describe : describe.skip;

const TEST_USER_ID = "00000000-0000-4000-8000-000000000099";
/** Per-file run prefix so afterAll can sweep any orphan from this process. */
const RUN_PREFIX = `shipper:vitest-delete-audit-${randomUUID()}`;

function setBackfillUser() {
  (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__ = {
    id: TEST_USER_ID,
    email: "vitest-delete-audit@test.local",
    name: "Vitest Delete Audit",
    role: "admin",
    language: "zh",
  };
}

function clearBackfillUser() {
  delete (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__;
}

describeIntegration("deleteInvoicePayment audit integration", () => {
  const trackedCustomerKeys = new Set<string>();
  const trackedPaymentIds = new Set<string>();

  function trackPayment(customerKey: string, paymentId: string) {
    trackedCustomerKeys.add(customerKey);
    trackedPaymentIds.add(paymentId);
  }

  /**
   * Always wipe payments for this run's customer keys / ids.
   * Must not fail silently — throws if leftovers remain.
   */
  async function forceCleanup(label: string) {
    const { prisma } = await import("@/lib/prisma");

    try {
      const keys = Array.from(trackedCustomerKeys);
      const ids = Array.from(trackedPaymentIds);

      const byKey =
        keys.length === 0
          ? []
          : await prisma.invoicePayment.findMany({
              where: { customerKey: { in: keys } },
              select: { id: true },
            });
      const byPrefix = await prisma.invoicePayment.findMany({
        where: { customerKey: { startsWith: RUN_PREFIX } },
        select: { id: true },
      });

      const allIds = Array.from(
        new Set([
          ...ids,
          ...byKey.map((r) => r.id),
          ...byPrefix.map((r) => r.id),
        ])
      );

      if (allIds.length > 0) {
        await prisma.invoicePaymentAllocation.deleteMany({
          where: { paymentId: { in: allIds } },
        });
        // Test DB only: remove audit rows for these payments so the suite is idempotent.
        await prisma.invoicePaymentChangeLog.deleteMany({
          where: {
            OR: [
              { paymentId: { in: allIds } },
              ...(keys.length > 0 ? [{ customerKey: { in: keys } }] : []),
              { customerKey: { startsWith: RUN_PREFIX } },
            ],
          },
        });
        await prisma.invoicePayment.deleteMany({
          where: { id: { in: allIds } },
        });
      }

      const leftover = await prisma.invoicePayment.count({
        where: {
          OR: [
            ...(keys.length > 0 ? [{ customerKey: { in: keys } }] : []),
            { customerKey: { startsWith: RUN_PREFIX } },
            ...(ids.length > 0 ? [{ id: { in: ids } }] : []),
          ],
        },
      });

      if (leftover > 0) {
        throw new Error(
          `[${label}] cleanup failed: ${leftover} payment(s) still present for ${RUN_PREFIX}*`
        );
      }

      // eslint-disable-next-line no-console
      console.info(`[${label}] cleanup ok (${allIds.length} id(s) swept)`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[${label}] cleanup error:`, error);
      throw error;
    } finally {
      trackedPaymentIds.clear();
      clearBackfillUser();
    }
  }

  beforeAll(() => {
    if (!canRun) return;
    if (process.env.DATABASE_URL !== TEST_DATABASE_URL) {
      throw new Error(
        "DATABASE_URL was not pinned to TEST_DATABASE_URL — aborting to protect production"
      );
    }
    assertSafeTestDatabaseUrl(process.env.DATABASE_URL);
  });

  beforeEach(() => {
    setBackfillUser();
  });

  afterEach(async () => {
    await forceCleanup("afterEach");
  });

  afterAll(async () => {
    if (!canRun) return;
    // Re-track prefix in case afterEach cleared sets but orphans remain.
    trackedCustomerKeys.add(RUN_PREFIX);
    await forceCleanup("afterAll");
  });

  it(
    "writes delete audit log, removes payment, and reruns allocation safely",
    async () => {
      const customerKey = `${RUN_PREFIX}-${randomUUID()}`;
      trackedCustomerKeys.add(customerKey);

      const { prisma } = await import("@/lib/prisma");
      const { deleteInvoicePayment } = await import(
        "@/app/actions/invoice-payments"
      );

      const payment = await prisma.invoicePayment.create({
        data: {
          customerKey,
          customerKind: "shipper",
          currency: "MYR",
          amount: 50000,
          paymentDate: new Date("2026-06-15T00:00:00.000Z"),
          // Valid enum (was typo WTL_PBB_1725); MYR-only account.
          bankAccount: "WTL_PBB1725",
          notes: "test 50000",
          allocationStrategy: "auto",
          unallocatedAmount: 50000,
          createdBy: TEST_USER_ID,
        },
      });
      trackPayment(customerKey, payment.id);

      await prisma.invoicePaymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceType: "freight",
          invoiceKey: "2026-06",
          yearMonth: "2026-06",
          currency: "MYR",
          amount: 31533.1,
          isManual: false,
        },
      });

      await deleteInvoicePayment(payment.id);

      const deleted = await prisma.invoicePayment.findUnique({
        where: { id: payment.id },
      });
      expect(deleted).toBeNull();

      const logs = await prisma.invoicePaymentChangeLog.findMany({
        where: { paymentId: payment.id, eventType: "delete" },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]?.changedBy).toBe(TEST_USER_ID);
      expect(logs[0]?.customerKey).toBe(customerKey);
      expect(logs[0]?.currency).toBe("MYR");

      const metadata = logs[0]?.metadata as Record<string, unknown>;
      expect(metadata.amount).toBe(50000);
      expect(metadata.paymentDate).toBe("2026-06-15");
      expect(metadata.notes).toBe("test 50000");
      expect(metadata.bankAccount).toBe("WTL_PBB1725");
      expect(metadata.allocationsBeforeSummary).toBe(
        "2026-06 freight|2026-06: 31533.10"
      );
    },
    60_000
  );

  it(
    "deletes the last payment on a ledger without throwing",
    async () => {
      const customerKey = `${RUN_PREFIX}-${randomUUID()}`;
      trackedCustomerKeys.add(customerKey);

      const { prisma } = await import("@/lib/prisma");
      const { deleteInvoicePayment } = await import(
        "@/app/actions/invoice-payments"
      );

      const payment = await prisma.invoicePayment.create({
        data: {
          customerKey,
          customerKind: "shipper",
          currency: "THB",
          amount: 1000,
          paymentDate: new Date("2026-06-01T00:00:00.000Z"),
          bankAccount: "CASH",
          allocationStrategy: "auto",
          unallocatedAmount: 1000,
          createdBy: TEST_USER_ID,
        },
      });
      trackPayment(customerKey, payment.id);

      await expect(deleteInvoicePayment(payment.id)).resolves.toEqual({
        ok: true,
      });

      expect(
        await prisma.invoicePayment.count({
          where: { customerKey, currency: "THB" },
        })
      ).toBe(0);
    },
    30_000
  );
});

if (!canRun) {
  describe("deleteInvoicePayment audit integration (guard)", () => {
    it("does not run against production; needs RUN_INTEGRATION=1 and TEST_DATABASE_URL", () => {
      expect(canRun).toBe(false);
    });
  });
}

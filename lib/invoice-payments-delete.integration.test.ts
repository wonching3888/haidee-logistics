import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/types";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const TEST_USER_ID = "00000000-0000-4000-8000-000000000099";
const TEST_CUSTOMER_KEY = `shipper:vitest-delete-audit-${randomUUID()}`;

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

describe("deleteInvoicePayment audit integration", () => {
  let createdPaymentId: string | null = null;

  beforeEach(() => {
    setBackfillUser();
  });

  afterEach(async () => {
    const { prisma } = await import("@/lib/prisma");
    if (createdPaymentId) {
      await prisma.invoicePaymentChangeLog.deleteMany({
        where: { paymentId: createdPaymentId },
      });
      await prisma.invoicePaymentAllocation.deleteMany({
        where: { paymentId: createdPaymentId },
      });
      await prisma.invoicePayment.deleteMany({
        where: { id: createdPaymentId },
      });
      createdPaymentId = null;
    }
    clearBackfillUser();
  });

  it(
    "writes delete audit log, removes payment, and reruns allocation safely",
    async () => {
    const { prisma } = await import("@/lib/prisma");
    const { deleteInvoicePayment } = await import("@/app/actions/invoice-payments");

    const payment = await prisma.invoicePayment.create({
      data: {
        customerKey: TEST_CUSTOMER_KEY,
        customerKind: "shipper",
        currency: "THB",
        amount: 50000,
        paymentDate: new Date("2026-06-15T00:00:00.000Z"),
        bankAccount: "WTL_PBB_1725",
        notes: "test 50000",
        allocationStrategy: "auto",
        unallocatedAmount: 50000,
        createdBy: TEST_USER_ID,
      },
    });
    createdPaymentId = payment.id;

    await prisma.invoicePaymentAllocation.create({
      data: {
        paymentId: payment.id,
        invoiceType: "freight",
        invoiceKey: "2026-06",
        yearMonth: "2026-06",
        currency: "THB",
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
    expect(logs[0]?.customerKey).toBe(TEST_CUSTOMER_KEY);
    expect(logs[0]?.currency).toBe("THB");

    const metadata = logs[0]?.metadata as Record<string, unknown>;
    expect(metadata.amount).toBe(50000);
    expect(metadata.paymentDate).toBe("2026-06-15");
    expect(metadata.notes).toBe("test 50000");
    expect(metadata.allocationsBeforeSummary).toBe(
      "2026-06 freight|2026-06: 31533.10"
    );
  }, 60_000);

  it(
    "deletes the last payment on a ledger without throwing",
    async () => {
    const { prisma } = await import("@/lib/prisma");
    const { deleteInvoicePayment } = await import("@/app/actions/invoice-payments");

    const payment = await prisma.invoicePayment.create({
      data: {
        customerKey: TEST_CUSTOMER_KEY,
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
    createdPaymentId = payment.id;

    await expect(deleteInvoicePayment(payment.id)).resolves.toEqual({ ok: true });

    expect(
      await prisma.invoicePayment.count({
        where: { customerKey: TEST_CUSTOMER_KEY, currency: "THB" },
      })
    ).toBe(0);
  }, 30_000);
});

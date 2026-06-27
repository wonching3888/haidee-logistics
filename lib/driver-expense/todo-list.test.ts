import { describe, expect, it } from "vitest";
import {
  computeUnsettledDays,
  isTodoUnsettledAlert,
  sortDriverExpenseTodoItems,
  type DriverExpenseTodoItem,
} from "@/lib/driver-expense/todo-list";

function item(
  partial: Partial<DriverExpenseTodoItem> & Pick<DriverExpenseTodoItem, "status" | "tripDate">
): DriverExpenseTodoItem {
  return {
    kind: partial.kind ?? "voucher",
    tripId: partial.tripId ?? "trip-1",
    tripSource: partial.tripSource ?? "dispatch",
    tripDate: partial.tripDate,
    lorry: "ABC 1234",
    driverName: "Ali",
    route: "KL / MC",
    dispatchNo: null,
    charterNo: null,
    unsettledDays: partial.unsettledDays ?? 0,
    ...partial,
  };
}

describe("computeUnsettledDays", () => {
  it("counts calendar days from trip date to today", () => {
    expect(computeUnsettledDays("2026-06-20", new Date("2026-06-26"))).toBe(6);
    expect(computeUnsettledDays("2026-06-26", new Date("2026-06-26"))).toBe(0);
  });
});

describe("sortDriverExpenseTodoItems", () => {
  it("puts pending_review first, then sorts by unsettled days desc", () => {
    const sorted = sortDriverExpenseTodoItems([
      item({ status: "clerk_entered", tripDate: "2026-06-01", unsettledDays: 20 }),
      item({ status: "pending_review", tripDate: "2026-06-20", unsettledDays: 1 }),
      item({ status: "unentered", kind: "unentered", tripDate: "2026-06-10", unsettledDays: 11 }),
      item({ status: "rejected", tripDate: "2026-06-05", unsettledDays: 15 }),
      item({ status: "pending_review", tripDate: "2026-06-01", unsettledDays: 19 }),
    ]);

    expect(sorted.map((row) => row.status)).toEqual([
      "pending_review",
      "pending_review",
      "clerk_entered",
      "rejected",
      "unentered",
    ]);
    expect(sorted[0].unsettledDays).toBe(19);
    expect(sorted[1].unsettledDays).toBe(1);
    expect(sorted[2].unsettledDays).toBe(20);
  });
});

describe("isTodoUnsettledAlert", () => {
  it("alerts from 7 days inclusive", () => {
    expect(isTodoUnsettledAlert(6)).toBe(false);
    expect(isTodoUnsettledAlert(7)).toBe(true);
  });
});

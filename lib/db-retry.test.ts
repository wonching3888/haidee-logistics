import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { describe, expect, it } from "vitest";
import { isRetriableDbConnectionError } from "@/lib/db-retry";

function prismaError(code: string, message: string) {
  return new PrismaClientKnownRequestError(message, {
    code,
    clientVersion: "7.8.0",
  });
}

describe("isRetriableDbConnectionError", () => {
  it('returns true for "Connection terminated unexpectedly"', () => {
    expect(
      isRetriableDbConnectionError(
        new Error("Connection terminated unexpectedly")
      )
    ).toBe(true);
  });

  it("returns true for Prisma P1017", () => {
    expect(
      isRetriableDbConnectionError(
        prismaError("P1017", "Server has closed the connection")
      )
    ).toBe(true);
  });

  it("returns false for Prisma P2002 (unique constraint)", () => {
    expect(
      isRetriableDbConnectionError(
        prismaError("P2002", "Unique constraint failed")
      )
    ).toBe(false);
  });

  it("returns false for generic business errors", () => {
    expect(isRetriableDbConnectionError(new Error("无权限"))).toBe(false);
  });
});

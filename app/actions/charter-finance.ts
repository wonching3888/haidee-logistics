"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isOtherMarket } from "@/lib/markets";
import {
  isCharterClass,
  normalizeCharterNote,
  parseCharterMoneyInput,
  parseRequiredCharterMoney,
  serializeCharterFinance,
  type CharterFinanceInput,
  type CharterFinanceRecord,
} from "@/lib/charter-finance";

export async function getCharterFinance(
  dispatchOrderId: string
): Promise<CharterFinanceRecord | null> {
  const row = await prisma.charterTripFinance.findUnique({
    where: { dispatchOrderId },
  });
  if (!row) return null;
  return serializeCharterFinance(row);
}

function validateCharterDispatch(markets: string[]) {
  if (!markets.some((code) => isOtherMarket(code))) {
    throw new Error(
      "仅 OTHER（包车）派车单可录入包车财务 Charter finance applies to OTHER market dispatches only"
    );
  }
}

function buildCharterFinanceData(input: CharterFinanceInput) {
  if (!isCharterClass(input.charterClass)) {
    throw new Error("请选择包车类型 A（海产）或 B（普货） Select charter class A or B");
  }

  const charterMileageKm = parseRequiredCharterMoney(
    input.charterMileageKm,
    "实际公里数 mileage"
  );
  if (charterMileageKm <= 0) {
    throw new Error("实际公里数须大于 0 Mileage must be greater than 0");
  }

  const charterRevenueMyr = parseRequiredCharterMoney(
    input.charterRevenueMyr,
    "客户总价 revenue"
  );
  if (charterRevenueMyr < 0) {
    throw new Error("客户总价不能为负数 Revenue cannot be negative");
  }

  const charterDriverSalaryMyr = parseCharterMoneyInput(
    input.charterDriverSalaryMyr
  );
  const charterExtraRevenueMyr = parseCharterMoneyInput(
    input.charterExtraRevenueMyr
  );
  const charterExtraCostMyr = parseCharterMoneyInput(input.charterExtraCostMyr);

  if (input.charterClass === "A") {
    return {
      charterClass: "A" as const,
      charterMileageKm,
      charterRevenueMyr,
      charterUnloadFeeMyr: parseCharterMoneyInput(input.charterUnloadFeeMyr),
      charterDriverSalaryMyr,
      charterOtherCostMyr: null,
      charterOtherCostNote: null,
      charterExtraRevenueMyr,
      charterExtraRevenueNote: normalizeCharterNote(
        input.charterExtraRevenueNote
      ),
      charterExtraCostMyr,
      charterExtraCostNote: normalizeCharterNote(input.charterExtraCostNote),
    };
  }

  return {
    charterClass: "B" as const,
    charterMileageKm,
    charterRevenueMyr,
    charterUnloadFeeMyr: null,
    charterDriverSalaryMyr,
    charterOtherCostMyr: parseCharterMoneyInput(input.charterOtherCostMyr),
    charterOtherCostNote: normalizeCharterNote(input.charterOtherCostNote),
    charterExtraRevenueMyr,
    charterExtraRevenueNote: normalizeCharterNote(input.charterExtraRevenueNote),
    charterExtraCostMyr,
    charterExtraCostNote: normalizeCharterNote(input.charterExtraCostNote),
  };
}

export async function saveCharterFinance(
  input: CharterFinanceInput
): Promise<{ ok: true }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录 Unauthorized");

  const dispatch = await prisma.dispatchOrder.findUnique({
    where: { id: input.dispatchOrderId },
    select: { id: true, markets: true },
  });
  if (!dispatch) throw new Error("派车单不存在 Dispatch order not found");

  validateCharterDispatch(dispatch.markets);
  const data = buildCharterFinanceData(input);

  await prisma.charterTripFinance.upsert({
    where: { dispatchOrderId: input.dispatchOrderId },
    create: {
      dispatchOrderId: input.dispatchOrderId,
      ...data,
    },
    update: data,
  });

  revalidatePath(`/dispatch/${input.dispatchOrderId}`);
  revalidatePath("/dispatch");

  return { ok: true };
}

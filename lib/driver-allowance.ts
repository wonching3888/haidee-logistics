import { MC_MARKET_CODE } from "@/lib/inbound-freight";

export interface DriverAllowanceLineInput {
  marketCode: string;
  quantity: number;
  isBox: boolean;
}

export function countDriverAllowanceCrates(lines: DriverAllowanceLineInput[]) {
  return lines
    .filter((line) => !line.isBox && line.marketCode !== MC_MARKET_CODE)
    .reduce((sum, line) => sum + line.quantity, 0);
}

export function computeDriverAllowanceAmount(
  lines: DriverAllowanceLineInput[],
  amountPerCrate: number | null | undefined
) {
  if (!amountPerCrate || amountPerCrate <= 0) {
    return { crates: countDriverAllowanceCrates(lines), amount: null };
  }
  const crates = countDriverAllowanceCrates(lines);
  return {
    crates,
    amount: Math.round(crates * amountPerCrate * 100) / 100,
  };
}

export interface PattaniContractorMonthlyDayRow {
  date: string;
  crateQty: number;
  boxQty: number;
  contractorThb: number;
}

export interface PattaniContractorMonthlySummary {
  year: number;
  month: number;
  days: PattaniContractorMonthlyDayRow[];
  totalCrates: number;
  totalBoxes: number;
  crateRate: number;
  boxRate: number;
  totalContractorThb: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Contractor cash payable only (crates×crateRate + boxes×boxRate), excludes SAKRI. */
export function computePattaniContractorMonthlySummary(input: {
  year: number;
  month: number;
  days: Array<{ date: string; crateQty: number; boxQty: number }>;
  crateRate: number;
  boxRate: number;
}): PattaniContractorMonthlySummary {
  const days: PattaniContractorMonthlyDayRow[] = input.days.map((day) => ({
    date: day.date,
    crateQty: day.crateQty,
    boxQty: day.boxQty,
    contractorThb: roundMoney(
      day.crateQty * input.crateRate + day.boxQty * input.boxRate
    ),
  }));
  const totalCrates = days.reduce((s, d) => s + d.crateQty, 0);
  const totalBoxes = days.reduce((s, d) => s + d.boxQty, 0);
  const totalContractorThb = roundMoney(
    totalCrates * input.crateRate + totalBoxes * input.boxRate
  );
  return {
    year: input.year,
    month: input.month,
    days,
    totalCrates,
    totalBoxes,
    crateRate: input.crateRate,
    boxRate: input.boxRate,
    totalContractorThb,
  };
}

import type { StatutoryDeductions } from "@/lib/payroll-statutory";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export interface StaffPayrollSummary {
  baseSalary: number;
  grossSalary: number;
  statutory: StatutoryDeductions;
  netSalary: number;
}

/**
 * v1 fixed monthly salary: gross = base (no allowances).
 * Net = gross − employee-borne statutory items.
 */
export function buildStaffPayrollSummary(input: {
  baseSalary: number;
  statutory: StatutoryDeductions;
}): StaffPayrollSummary {
  const baseSalary = roundMoney(Math.max(0, input.baseSalary));
  const grossSalary = baseSalary;
  const { statutory } = input;
  const netSalary = roundMoney(
    grossSalary -
      statutory.epfEmployee -
      statutory.socsoEmployee -
      statutory.eisEmployee -
      statutory.lindung24Jam -
      statutory.pcb
  );

  return { baseSalary, grossSalary, statutory, netSalary };
}

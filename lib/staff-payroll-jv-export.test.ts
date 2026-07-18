import { describe, expect, it } from "vitest";
import { canExportStaffPayrollJv } from "@/lib/auth-roles";
import { buildStaffJvAccountCodes } from "@/lib/constants/staff-payroll-jv-accounts";
import { SHARED_PAYROLL_JV_ACCOUNTS } from "@/lib/constants/payroll-jv-accounts";
import {
  buildStaffPersonJvAmounts,
  generateStaffPayrollJvCsv,
  pushStaffPersonExpenseLines,
  staffPayrollJvCsvFilename,
  type MonthlyStaffPayrollJvResult,
  type StaffPayrollJvLine,
} from "@/lib/staff-payroll-jv-export";
import { buildStaffPayrollSummary } from "@/lib/staff-payroll-statutory";
import type { StatutoryDeductions } from "@/lib/payroll-statutory";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

/** Synthetic but internally-consistent statutory figures (not real EPF/SOCSO
 * bracket lookups — those are covered by payroll-epf-flat-rate.test.ts /
 * staff-payroll-calc.test.ts). Only the JV plumbing is under test here. */
function statutory(overrides: Partial<StatutoryDeductions>): StatutoryDeductions {
  return {
    epfEmployee: 0,
    epfEmployer: 0,
    socsoEmployee: 0,
    socsoEmployer: 0,
    lindung24Jam: 0,
    eisEmployee: 0,
    eisEmployer: 0,
    pcb: 0,
    ...overrides,
  };
}

/** Wong — regular salary, base 8,500, flat-13% employer EPF (1,105 — matches
 * the real June 2026 discrepancy this feature was built to reconcile). */
function wongSummary() {
  return buildStaffPayrollSummary({
    baseSalary: 8500,
    statutory: statutory({
      epfEmployee: 935,
      epfEmployer: 1105,
      socsoEmployee: 30,
      socsoEmployer: 105,
      lindung24Jam: 16,
      eisEmployee: 40,
      eisEmployer: 40,
      pcb: 180,
    }),
  });
}

/** Lim — director remuneration category, base 5,000. */
function limDirectorSummary() {
  return buildStaffPayrollSummary({
    baseSalary: 5000,
    statutory: statutory({
      epfEmployee: 550,
      epfEmployer: 650,
      socsoEmployee: 20,
      socsoEmployer: 70,
      lindung24Jam: 10,
      eisEmployee: 25,
      eisEmployer: 25,
      pcb: 50,
    }),
  });
}

/** Chew — regular salary, base 3,100, under the RM5,000 threshold. */
function chewSummary() {
  return buildStaffPayrollSummary({
    baseSalary: 3100,
    statutory: statutory({
      epfEmployee: 341,
      epfEmployer: 403,
      socsoEmployee: 12.75,
      socsoEmployer: 44.65,
      lindung24Jam: 6.65,
      eisEmployee: 15.5,
      eisEmployer: 15.5,
      pcb: 0,
    }),
  });
}

describe("staff payroll JV export permissions", () => {
  it("allows admin and my_accounting only, same gate as driver payroll JV", () => {
    expect(canExportStaffPayrollJv("admin")).toBe(true);
    expect(canExportStaffPayrollJv("my_accounting")).toBe(true);
    expect(canExportStaffPayrollJv("accounting")).toBe(false);
    expect(canExportStaffPayrollJv("clerk")).toBe(false);
    expect(canExportStaffPayrollJv("viewer")).toBe(false);
  });
});

describe("buildStaffJvAccountCodes", () => {
  it("regular salary uses the 9000 base-salary prefix", () => {
    const accounts = buildStaffJvAccountCodes({
      accountCodeSuffix: "wong",
      payrollCategory: "salary",
    });
    expect(accounts.baseSalary).toBe("9000-WONG");
    expect(accounts.epfEmployer).toBe("9005-WONG");
    expect(accounts.socsoEisEmployer).toBe("9006-WONG");
    expect(accounts.netPayable).toBe("4104-WONG");
    expect(accounts.epfPayable).toBe(SHARED_PAYROLL_JV_ACCOUNTS.epfPayable);
    expect(accounts.socsoEisPayable).toBe(
      SHARED_PAYROLL_JV_ACCOUNTS.socsoEisPayable
    );
    expect(accounts.pcbPayable).toBe(SHARED_PAYROLL_JV_ACCOUNTS.pcbPayable);
  });

  it("director_remuneration uses the 9003 prefix instead of 9000", () => {
    const accounts = buildStaffJvAccountCodes({
      accountCodeSuffix: "LIM",
      payrollCategory: "director_remuneration",
    });
    expect(accounts.baseSalary).toBe("9003-LIM");
  });

  it("rejects an empty account code suffix", () => {
    expect(() =>
      buildStaffJvAccountCodes({ accountCodeSuffix: "  ", payrollCategory: "salary" })
    ).toThrow(/科目后缀/);
  });
});

describe("buildStaffPersonJvAmounts", () => {
  it("rolls up employer cost + payable buckets from a StaffPayrollSummary", () => {
    const amounts = buildStaffPersonJvAmounts(wongSummary());
    expect(amounts.baseSalary).toBe(8500);
    expect(amounts.epfEmployer).toBe(1105);
    expect(amounts.socsoEisEmployer).toBe(roundMoney(105 + 40)); // socsoEmployer + eisEmployer
    expect(amounts.epfPayable).toBe(roundMoney(935 + 1105)); // employee + employer
    expect(amounts.socsoEisLindungPayable).toBe(
      roundMoney(30 + 40 + 105 + 40 + 16) // socso'ee + eis'ee + socso'er + eis'er + lindung
    );
    expect(amounts.pcb).toBe(180);
    // netSalary comes straight from buildStaffPayrollSummary — sanity-check it
    // against the same deduction set the payslip prints.
    expect(amounts.netSalary).toBe(
      roundMoney(8500 - 935 - 30 - 40 - 16 - 180)
    );
  });
});

describe("multi-staff JV balance (mirrors buildMonthlyStaffJvRows aggregation)", () => {
  it("debit total equals credit total across a mixed staff/director group", () => {
    const roster = [
      { name: "Wong", accountCodeSuffix: "WONG", payrollCategory: "salary", summary: wongSummary() },
      { name: "Lim", accountCodeSuffix: "LIM", payrollCategory: "director_remuneration", summary: limDirectorSummary() },
      { name: "Chew", accountCodeSuffix: "CHEW", payrollCategory: "salary", summary: chewSummary() },
    ];

    const lines: StaffPayrollJvLine[] = [];
    let sumEpfPayable = 0;
    let sumSocsoEisLindungPayable = 0;
    let sumPcb = 0;

    for (const person of roster) {
      const amounts = buildStaffPersonJvAmounts(person.summary);
      pushStaffPersonExpenseLines({
        lines,
        staff: {
          name: person.name,
          accountCodeSuffix: person.accountCodeSuffix,
          payrollCategory: person.payrollCategory,
        },
        amounts,
        jvNo: "JV-STAFF-2607",
        jvDate: "2026-07-31",
      });
      sumEpfPayable = roundMoney(sumEpfPayable + amounts.epfPayable);
      sumSocsoEisLindungPayable = roundMoney(
        sumSocsoEisLindungPayable + amounts.socsoEisLindungPayable
      );
      sumPcb = roundMoney(sumPcb + amounts.pcb);
    }

    // Shared company remittance lines — one each, summed across all staff
    // (exactly mirroring the non-DB part of buildMonthlyStaffJvRows).
    lines.push(
      { date: "2026-07-31", jvNo: "JV-STAFF-2607", accountCode: SHARED_PAYROLL_JV_ACCOUNTS.epfPayable, debit: 0, credit: sumEpfPayable, description: "EPF应付" },
      { date: "2026-07-31", jvNo: "JV-STAFF-2607", accountCode: SHARED_PAYROLL_JV_ACCOUNTS.socsoEisPayable, debit: 0, credit: sumSocsoEisLindungPayable, description: "SOCSO/EIS/Lindung 应付" },
      { date: "2026-07-31", jvNo: "JV-STAFF-2607", accountCode: SHARED_PAYROLL_JV_ACCOUNTS.pcbPayable, debit: 0, credit: sumPcb, description: "PCB应付" }
    );

    const debitTotal = roundMoney(lines.reduce((s, l) => s + l.debit, 0));
    const creditTotal = roundMoney(lines.reduce((s, l) => s + l.credit, 0));

    expect(debitTotal).toBe(creditTotal);
    // Every line must hit exactly one side — never both, never neither.
    for (const line of lines) {
      expect(line.debit === 0 || line.credit === 0).toBe(true);
      expect(line.debit > 0 || line.credit > 0).toBe(true);
    }
  });

  it("single staff member alone still balances (no shared-line cross-contamination)", () => {
    const amounts = buildStaffPersonJvAmounts(chewSummary());
    const lines: StaffPayrollJvLine[] = [];
    pushStaffPersonExpenseLines({
      lines,
      staff: { name: "Chew", accountCodeSuffix: "CHEW", payrollCategory: "salary" },
      amounts,
      jvNo: "JV-STAFF-2607",
      jvDate: "2026-07-31",
    });
    lines.push(
      { date: "2026-07-31", jvNo: "JV-STAFF-2607", accountCode: SHARED_PAYROLL_JV_ACCOUNTS.epfPayable, debit: 0, credit: amounts.epfPayable, description: "EPF应付" },
      { date: "2026-07-31", jvNo: "JV-STAFF-2607", accountCode: SHARED_PAYROLL_JV_ACCOUNTS.socsoEisPayable, debit: 0, credit: amounts.socsoEisLindungPayable, description: "SOCSO/EIS/Lindung 应付" },
      { date: "2026-07-31", jvNo: "JV-STAFF-2607", accountCode: SHARED_PAYROLL_JV_ACCOUNTS.pcbPayable, debit: 0, credit: amounts.pcb, description: "PCB应付" }
    );
    const debitTotal = roundMoney(lines.reduce((s, l) => s + l.debit, 0));
    const creditTotal = roundMoney(lines.reduce((s, l) => s + l.credit, 0));
    expect(debitTotal).toBe(creditTotal);
  });
});

describe("generateStaffPayrollJvCsv", () => {
  function balancedResult(): MonthlyStaffPayrollJvResult {
    const lines: StaffPayrollJvLine[] = [
      { date: "2026-07-31", jvNo: "JV-STAFF-2607", accountCode: "9000-CHEW", debit: 3100, credit: 0, description: "底薪 Base Salary - Chew" },
      { date: "2026-07-31", jvNo: "JV-STAFF-2607", accountCode: "4104-CHEW", debit: 0, credit: 3100, description: "实发 Net Pay - Chew" },
    ];
    return {
      year: 2026,
      month: 7,
      yearMonth: "2026-07",
      jvDate: "2026-07-31",
      jvNo: "JV-STAFF-2607",
      staff: [],
      skippedStaff: [],
      flatLines: lines,
      debitTotal: 3100,
      creditTotal: 3100,
      imbalance: 0,
      balanced: true,
      allBalanced: true,
    };
  }

  it("throws instead of exporting an unbalanced JV", () => {
    const result = { ...balancedResult(), allBalanced: false, imbalance: 12.5 };
    expect(() => generateStaffPayrollJvCsv(result)).toThrow(/不平衡|Unbalanced/);
  });

  it("emits a BOM + bilingual header + one row per line for a balanced JV", () => {
    const csv = generateStaffPayrollJvCsv(balancedResult());
    expect(csv.startsWith("﻿")).toBe(true);
    const rows = csv.replace(/^﻿/, "").trim().split("\n");
    expect(rows[0]).toBe("日期 Date,JV号 JVNo,科目码 AccountCode,借 Debit,贷 Credit,备注 Description");
    expect(rows).toHaveLength(3); // header + 2 lines
    expect(rows[1]).toBe("2026-07-31,JV-STAFF-2607,9000-CHEW,3100.00,,底薪 Base Salary - Chew");
  });

  it("filename follows the staff-payroll-jv-YYYY-MM.csv convention", () => {
    expect(staffPayrollJvCsvFilename(2026, 7)).toBe("staff-payroll-jv-2026-07.csv");
  });
});

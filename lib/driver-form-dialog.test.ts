import { describe, expect, it } from "vitest";
import {
  driverToFormValue,
  parseDriverFormValue,
} from "@/components/settings/DriverFormDialog";
import { formatDisplay } from "@/lib/date-utils";

describe("driverToFormValue terminationDate", () => {
  const base = {
    name: "Akim",
    fullName: null as string | null,
    active: true,
    baseSalary: 1700,
    autoCountEmployeeCode: null as string | null,
    icNumber: null as string | null,
    epfNumber: null as string | null,
    socsoNumber: null as string | null,
    maritalStatus: "single" as string | null,
    childCount: 0,
  };

  it("null terminationDate → empty form string (not today)", () => {
    const form = driverToFormValue({ ...base, terminationDate: null });
    expect(form.terminationDate).toBe("");
    expect(formatDisplay(form.terminationDate)).toBe("");
    expect(parseDriverFormValue(form).terminationDate).toBeNull();
  });

  it("Din 2026-06-10 stays 2026-06-10 (display 10/06/2026), not today", () => {
    const form = driverToFormValue({
      ...base,
      name: "Din",
      active: false,
      terminationDate: "2026-06-10",
    });
    expect(form.terminationDate).toBe("2026-06-10");
    expect(formatDisplay(form.terminationDate)).toBe("10/06/2026");
    expect(parseDriverFormValue(form).terminationDate).toBe("2026-06-10");
  });
});

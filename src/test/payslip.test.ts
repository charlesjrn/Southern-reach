import { describe, expect, it } from "vitest";
import { netPay } from "@/lib/payslip";

describe("netPay", () => {
  it("adds allowances and subtracts deductions and tax as entered", () => {
    expect(netPay(1000, 100, 50, 200)).toBe(850);
  });

  it("handles zero values and rounds to cents", () => {
    expect(netPay(0, 0, 0, 0)).toBe(0);
    expect(netPay(100.1, 0, 0.005, 0)).toBe(100.1);
  });
});

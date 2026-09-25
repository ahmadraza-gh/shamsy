import { describe, expect, it } from "vitest";

import {
  calculateLineTotal,
  calculateLineValue,
  calculateOrderAmounts,
  calculateSdgTotal,
  discountPercentageHundredths,
  formatDiscountPercentage,
  formatSdg,
  formatUsd,
  getDiscountBand,
  parseUsdToCents,
  requiresOwnerApproval,
} from "@/lib/money";

describe("integer financial rules", () => {
  it("calculates a line value in cents", () => {
    expect(calculateLineValue(51_500, 4)).toBe(206_000);
  });

  it("calculates a line total in cents", () => {
    expect(calculateLineTotal(206_000, 4_000)).toBe(202_000);
  });

  it.each([
    { discount: 0, value: 10_000, expected: "normal" },
    { discount: 1, value: 10_000, expected: "sand" },
    { discount: 300, value: 10_000, expected: "sand" },
    { discount: 301, value: 10_000, expected: "red" },
    { discount: 500, value: 10_000, expected: "red" },
    { discount: 501, value: 10_000, expected: "blocked" },
  ] as const)("classifies $discount / $value as $expected", ({ discount, value, expected }) => {
    expect(getDiscountBand(discount, value)).toBe(expected);
  });

  it("uses exact threshold arithmetic even when the displayed percentage rounds down", () => {
    expect(formatDiscountPercentage(10, 333)).toBe("3.00%");
    expect(getDiscountBand(10, 333)).toBe("red");
  });

  it("marks only values mathematically above 5% for approval", () => {
    expect(requiresOwnerApproval(500, 10_000)).toBe(false);
    expect(requiresOwnerApproval(501, 10_000)).toBe(true);
  });

  it("reproduces all worked line percentages exactly", () => {
    expect(formatDiscountPercentage(4_000, 206_000)).toBe("1.94%");
    expect(formatDiscountPercentage(7_000, 162_000)).toBe("4.32%");
    expect(formatDiscountPercentage(15_000, 207_000)).toBe("7.25%");
    expect(discountPercentageHundredths(15_000, 207_000)).toBe(725);
  });

  it("reproduces the two-line acceptance total", () => {
    expect(
      calculateOrderAmounts(
        [
          { unitPriceCents: 51_500, quantity: 4, discountCents: 4_000 },
          { unitPriceCents: 81_000, quantity: 2, discountCents: 7_000 },
        ],
        8_200,
      ),
    ).toEqual({
      subtotalCents: 368_000,
      discountCents: 11_000,
      totalCents: 357_000,
      sdgTotal: 29_274_000,
    });
  });

  it("reproduces the approved three-line acceptance total", () => {
    expect(
      calculateOrderAmounts(
        [
          { unitPriceCents: 51_500, quantity: 4, discountCents: 4_000 },
          { unitPriceCents: 81_000, quantity: 2, discountCents: 7_000 },
          { unitPriceCents: 207_000, quantity: 1, discountCents: 15_000 },
        ],
        8_200,
      ),
    ).toEqual({
      subtotalCents: 575_000,
      discountCents: 26_000,
      totalCents: 549_000,
      sdgTotal: 45_018_000,
    });
  });

  it("rounds fractional whole-SDG totals half up with integer arithmetic", () => {
    expect(calculateSdgTotal(1, 8_049)).toBe(80);
    expect(calculateSdgTotal(1, 8_050)).toBe(81);
  });

  it("parses decimal USD without floating-point conversion", () => {
    expect(parseUsdToCents("1,234.56")).toBe(123_456);
    expect(parseUsdToCents("40")).toBe(4_000);
    expect(parseUsdToCents("1.234")).toBeNull();
  });

  it("rejects invalid quantities and discounts", () => {
    expect(() => calculateLineValue(51_500, 0)).toThrow("greater than zero");
    expect(() => calculateLineTotal(10_000, 10_001)).toThrow("cannot exceed");
    expect(() => calculateLineTotal(10_000, -1)).toThrow("cannot be negative");
  });

  it("formats acceptance values consistently", () => {
    expect(formatUsd(51_500)).toBe("$515.00");
    expect(formatUsd(549_000)).toBe("$5,490.00");
    expect(formatSdg(45_018_000)).toBe("45,018,000 SDG");
  });
});


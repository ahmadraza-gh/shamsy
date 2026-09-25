import { describe, expect, it } from "vitest";

import { saveOrderInputSchema } from "@/features/orders/schemas";

const validInput = {
  dealerId: "00000000-0000-4000-8000-000000000001",
  exchangeRate: 8_200,
  lines: [
    {
      productId: "10000000-0000-4000-8000-000000000001",
      quantity: 4,
      discountCents: 4_000,
      catalogUpdatedAt: "2026-09-25T00:00:00.000Z",
    },
  ],
};

describe("order mutation input", () => {
  it("accepts only browser-controlled choices", () => {
    expect(saveOrderInputSchema.parse(validInput)).toEqual(validInput);
  });

  it("rejects a manipulated product price", () => {
    const result = saveOrderInputSchema.safeParse({
      ...validInput,
      lines: [{ ...validInput.lines[0], unitPriceCents: 10_000 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects forged totals and approval flags", () => {
    expect(
      saveOrderInputSchema.safeParse({ ...validInput, totalCents: 1 }).success,
    ).toBe(false);
    expect(
      saveOrderInputSchema.safeParse({
        ...validInput,
        lines: [{ ...validInput.lines[0], approvalStatus: "approved" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a server submission below the minimum rate", () => {
    expect(
      saveOrderInputSchema.safeParse({ ...validInput, exchangeRate: 7_900 }).success,
    ).toBe(false);
  });

  it("requires at least one valid, positive-quantity line", () => {
    expect(saveOrderInputSchema.safeParse({ ...validInput, lines: [] }).success).toBe(false);
    expect(
      saveOrderInputSchema.safeParse({
        ...validInput,
        lines: [{ ...validInput.lines[0], quantity: 0 }],
      }).success,
    ).toBe(false);
  });
});

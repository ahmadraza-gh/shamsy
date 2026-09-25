export type DiscountBand = "normal" | "sand" | "red" | "blocked";

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer.`);
  }
}

function fromBigInt(value: bigint, label: string): number {
  if (value < -MAX_SAFE || value > MAX_SAFE) {
    throw new RangeError(`${label} is outside the supported safe-integer range.`);
  }

  return Number(value);
}

export function calculateLineValue(
  unitPriceCents: number,
  quantity: number,
): number {
  assertSafeInteger(unitPriceCents, "Unit price");
  assertSafeInteger(quantity, "Quantity");

  if (unitPriceCents < 0) throw new RangeError("Unit price cannot be negative.");
  if (quantity <= 0) throw new RangeError("Quantity must be greater than zero.");

  return fromBigInt(
    BigInt(unitPriceCents) * BigInt(quantity),
    "Line value",
  );
}

export function calculateLineTotal(
  lineValueCents: number,
  discountCents: number,
): number {
  assertSafeInteger(lineValueCents, "Line value");
  assertSafeInteger(discountCents, "Discount");

  if (lineValueCents < 0) throw new RangeError("Line value cannot be negative.");
  if (discountCents < 0) throw new RangeError("Discount cannot be negative.");
  if (discountCents > lineValueCents) {
    throw new RangeError("Discount cannot exceed the line value.");
  }

  return lineValueCents - discountCents;
}

export function getDiscountBand(
  discountCents: number,
  lineValueCents: number,
): DiscountBand {
  assertSafeInteger(discountCents, "Discount");
  assertSafeInteger(lineValueCents, "Line value");

  if (lineValueCents < 0) throw new RangeError("Line value cannot be negative.");
  if (discountCents < 0 || discountCents > lineValueCents) {
    throw new RangeError("Discount must be between zero and the line value.");
  }

  if (discountCents === 0) return "normal";
  if (lineValueCents === 0) {
    throw new RangeError("A zero-value line cannot have a discount.");
  }

  const discount = BigInt(discountCents) * 100n;
  const value = BigInt(lineValueCents);

  if (discount <= value * 3n) return "sand";
  if (discount <= value * 5n) return "red";
  return "blocked";
}

export function requiresOwnerApproval(
  discountCents: number,
  lineValueCents: number,
): boolean {
  return getDiscountBand(discountCents, lineValueCents) === "blocked";
}

export function discountPercentageHundredths(
  discountCents: number,
  lineValueCents: number,
): number {
  assertSafeInteger(discountCents, "Discount");
  assertSafeInteger(lineValueCents, "Line value");

  if (lineValueCents <= 0) return 0;
  if (discountCents < 0 || discountCents > lineValueCents) {
    throw new RangeError("Discount must be between zero and the line value.");
  }

  const numerator = BigInt(discountCents) * 10_000n;
  const rounded = (numerator + BigInt(lineValueCents) / 2n) /
    BigInt(lineValueCents);

  return fromBigInt(rounded, "Discount percentage");
}

export function calculateSdgTotal(
  totalCents: number,
  exchangeRate: number,
): number {
  assertSafeInteger(totalCents, "Order total");
  assertSafeInteger(exchangeRate, "Exchange rate");

  if (totalCents < 0) throw new RangeError("Order total cannot be negative.");
  if (exchangeRate < 0) throw new RangeError("Exchange rate cannot be negative.");

  // The product can have fractional SDG when USD cents do not divide evenly.
  // Store a whole-SDG result using an explicit half-up rule.
  const sdg = (BigInt(totalCents) * BigInt(exchangeRate) + 50n) / 100n;
  return fromBigInt(sdg, "SDG total");
}

export interface OrderAmounts {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  sdgTotal: number;
}

export function calculateOrderAmounts(
  lines: ReadonlyArray<{
    unitPriceCents: number;
    quantity: number;
    discountCents: number;
  }>,
  exchangeRate: number,
): OrderAmounts {
  let subtotal = 0n;
  let discount = 0n;

  for (const line of lines) {
    const lineValue = calculateLineValue(line.unitPriceCents, line.quantity);
    calculateLineTotal(lineValue, line.discountCents);
    subtotal += BigInt(lineValue);
    discount += BigInt(line.discountCents);
  }

  const subtotalCents = fromBigInt(subtotal, "Order subtotal");
  const discountCents = fromBigInt(discount, "Order discount");
  const totalCents = subtotalCents - discountCents;

  return {
    subtotalCents,
    discountCents,
    totalCents,
    sdgTotal: calculateSdgTotal(totalCents, exchangeRate),
  };
}

export function parseUsdToCents(input: string): number | null {
  const normalized = input.trim().replaceAll(",", "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(normalized);
  if (!match) return null;

  const whole = BigInt(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const cents = whole * 100n + BigInt(fraction || "0");

  if (cents > MAX_SAFE) return null;
  return Number(cents);
}

export function formatUsd(cents: number): string {
  assertSafeInteger(cents, "USD amount");
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}$${new Intl.NumberFormat("en-US").format(whole)}.${fraction}`;
}

export function formatSdg(amount: number): string {
  assertSafeInteger(amount, "SDG amount");
  return `${new Intl.NumberFormat("en-US").format(amount)} SDG`;
}

export function formatDiscountPercentage(
  discountCents: number,
  lineValueCents: number,
): string {
  const hundredths = discountPercentageHundredths(
    discountCents,
    lineValueCents,
  );
  return `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, "0")}%`;
}

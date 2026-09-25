import { z } from "zod";

import {
  MAXIMUM_DISCOUNT_CENTS,
  MAXIMUM_EXCHANGE_RATE,
  MAXIMUM_QUANTITY,
  MINIMUM_EXCHANGE_RATE,
} from "@/features/orders/constants";

export const orderLineInputSchema = z
  .object({
    productId: z.uuid(),
    quantity: z.number().int().positive().max(MAXIMUM_QUANTITY),
    discountCents: z
      .number()
      .int()
      .nonnegative()
      .max(MAXIMUM_DISCOUNT_CENTS),
    catalogUpdatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const saveOrderInputSchema = z
  .object({
    dealerId: z.uuid(),
    exchangeRate: z
      .number()
      .int()
      .min(MINIMUM_EXCHANGE_RATE)
      .max(MAXIMUM_EXCHANGE_RATE),
    lines: z.array(orderLineInputSchema).min(1).max(100),
  })
  .strict();

export const updateRateInputSchema = z
  .object({
    currentExchangeRate: z
      .number()
      .int()
      .min(MINIMUM_EXCHANGE_RATE)
      .max(MAXIMUM_EXCHANGE_RATE),
  })
  .strict();

export type SaveOrderInput = z.infer<typeof saveOrderInputSchema>;

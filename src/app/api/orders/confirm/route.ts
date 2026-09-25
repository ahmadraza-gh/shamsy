import { NextResponse } from "next/server";
import { z } from "zod";

import { saveOrderInputSchema } from "@/features/orders/schemas";
import { databaseError, getApiActor, jsonError, validationError } from "@/lib/api";
import { isTrustedMutationRequest } from "@/lib/request-security";

const confirmOrderInputSchema = saveOrderInputSchema.extend({
  orderId: z.uuid().nullable().optional(),
});

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return jsonError("Request origin is not allowed.", 403);
  const { supabase, user } = await getApiActor();
  if (!user) return jsonError("Authentication required.", 401);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const result = confirmOrderInputSchema.safeParse(input);
  if (!result.success) return validationError(result.error);

  const { data, error } = await supabase.rpc("save_and_finalize_order", {
    p_dealer_id: result.data.dealerId,
    p_exchange_rate: result.data.exchangeRate,
    p_lines: result.data.lines,
    p_order_id: result.data.orderId ?? null,
  });

  if (error) return databaseError(error);
  return NextResponse.json({ orderId: data }, { status: 201 });
}

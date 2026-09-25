import { NextResponse } from "next/server";
import { z } from "zod";

import { saveOrderInputSchema } from "@/features/orders/schemas";
import { databaseError, getApiActor, jsonError, validationError } from "@/lib/api";
import { isTrustedMutationRequest } from "@/lib/request-security";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  if (!isTrustedMutationRequest(request)) return jsonError("Request origin is not allowed.", 403);
  const { supabase, user } = await getApiActor();
  if (!user) return jsonError("Authentication required.", 401);

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return jsonError("Order was not found.", 404);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const result = saveOrderInputSchema.safeParse(input);
  if (!result.success) return validationError(result.error);

  const { data, error } = await supabase.rpc("save_order_draft", {
    p_dealer_id: result.data.dealerId,
    p_exchange_rate: result.data.exchangeRate,
    p_lines: result.data.lines,
    p_order_id: id,
  });

  if (error) return databaseError(error);
  return NextResponse.json({ orderId: data });
}

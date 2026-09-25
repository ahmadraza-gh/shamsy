import { NextResponse } from "next/server";

import { updateRateInputSchema } from "@/features/orders/schemas";
import { databaseError, getApiActor, jsonError, validationError } from "@/lib/api";
import { isTrustedMutationRequest } from "@/lib/request-security";

export async function PATCH(request: Request) {
  if (!isTrustedMutationRequest(request)) return jsonError("Request origin is not allowed.", 403);
  const { supabase, user, role } = await getApiActor();
  if (!user) return jsonError("Authentication required.", 401);
  if (role !== "owner") return jsonError("Only an owner can update settings.", 403);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const result = updateRateInputSchema.safeParse(input);
  if (!result.success) return validationError(result.error);

  const { data, error } = await supabase.rpc("set_current_exchange_rate", {
    p_exchange_rate: result.data.currentExchangeRate,
  });
  if (error) return databaseError(error);

  return NextResponse.json({ currentExchangeRate: data });
}

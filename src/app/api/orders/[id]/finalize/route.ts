import { NextResponse } from "next/server";
import { z } from "zod";

import { databaseError, getApiActor, jsonError } from "@/lib/api";
import { isTrustedMutationRequest } from "@/lib/request-security";

const finalizeInputSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
}).strict();

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  if (!isTrustedMutationRequest(request)) return jsonError("Request origin is not allowed.", 403);
  const { supabase, user } = await getApiActor();
  if (!user) return jsonError("Authentication required.", 401);

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return jsonError("Order was not found.", 404);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError("A current order version is required.", 400);
  }
  const parsed = finalizeInputSchema.safeParse(input);
  if (!parsed.success) return jsonError("A current order version is required.", 422);

  const { data, error } = await supabase.rpc("finalize_order", {
    p_order_id: id,
    p_expected_updated_at: parsed.data.expectedUpdatedAt,
  });
  if (error) return databaseError(error);

  return NextResponse.json({ orderId: data, status: "confirmed" });
}

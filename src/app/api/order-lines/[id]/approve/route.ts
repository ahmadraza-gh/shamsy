import { NextResponse } from "next/server";
import { z } from "zod";

import { databaseError, getApiActor, jsonError } from "@/lib/api";
import { isTrustedMutationRequest } from "@/lib/request-security";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  if (!isTrustedMutationRequest(request)) return jsonError("Request origin is not allowed.", 403);
  const { supabase, user, role } = await getApiActor();
  if (!user) return jsonError("Authentication required.", 401);
  if (role !== "owner") {
    return jsonError("You do not have permission to approve this discount.", 403);
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return jsonError("Order line was not found.", 404);

  const { data, error } = await supabase.rpc("approve_order_line", {
    p_line_id: id,
  });
  if (error) return databaseError(error);

  return NextResponse.json({ lineId: data, approvalStatus: "approved" });
}

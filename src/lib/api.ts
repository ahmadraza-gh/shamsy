import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/models";

export async function getApiActor() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.name !== "AuthSessionMissingError") {
    throw new Error("Authentication could not be verified.");
  }
  if (!user) return { supabase, user: null, role: null };

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error("Authorization could not be verified.");

  return {
    supabase,
    user,
    role: (data?.role as AppRole | undefined) ?? null,
  };
}

export function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status },
  );
}

export function validationError(error: ZodError) {
  return jsonError("Please correct the invalid order fields.", 422, error.issues);
}

export function databaseError(error: PostgrestError) {
  if (error.code === "42501") {
    return jsonError("You do not have permission to perform this action.", 403);
  }
  if (error.code === "28000") return jsonError("Authentication required.", 401);
  if (error.code === "P0002" || error.code === "23503") {
    return jsonError("The requested record was not found.", 404);
  }
  if (error.code === "40001") {
    return jsonError("The record changed while you were working. Refresh and try again.", 409);
  }
  if (error.code === "55000") {
    return jsonError("This action is not allowed in the record's current state.", 409);
  }
  if (error.code === "23505") {
    return jsonError("The request conflicts with an existing record.", 409);
  }
  if (error.code === "22023" || error.code === "22003" || error.code === "23514") {
    return jsonError("One or more submitted values are outside the allowed limits.", 422);
  }

  console.error("Database mutation failed", {
    code: error.code,
    message: error.message,
  });
  return jsonError("The request could not be completed. Please try again.", 500);
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { hasSupabaseEnvironment } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface LoginState {
  error: string | null;
}

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(1024),
});

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return { error: "Enter a valid email address and password." };
  }

  if (!hasSupabaseEnvironment()) {
    return { error: "Sign-in is temporarily unavailable. Please try again later." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.signInWithPassword(result.data);

  if (error || !user) {
    if (error?.code === "invalid_credentials") {
      return { error: "Email or password is incorrect." };
    }
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return profileError
      ? { error: "Sign-in is temporarily unavailable. Please try again." }
      : { error: "This account does not have access. Contact your administrator." };
  }

  redirect("/orders/new");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

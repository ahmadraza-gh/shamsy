import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/types/models";

export const getViewer = cache(async (): Promise<Profile | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.name !== "AuthSessionMissingError") {
    throw new Error("The authentication service is temporarily unavailable.");
  }

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error("Your account profile could not be loaded.");
  if (!data) throw new Error("Your account is not provisioned for this application.");
  return data as Profile;
});

export async function requireViewer(allowedRoles?: AppRole[]): Promise<Profile> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (allowedRoles && !allowedRoles.includes(viewer.role)) redirect("/orders");
  return viewer;
}

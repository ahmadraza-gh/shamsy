import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { getSupabaseEnvironment, hasSupabaseEnvironment } from "@/lib/supabase/env";

export async function refreshSupabaseSession(request: NextRequest) {
  if (!hasSupabaseEnvironment()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseEnvironment();
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
        }
        response = NextResponse.next({ request });
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

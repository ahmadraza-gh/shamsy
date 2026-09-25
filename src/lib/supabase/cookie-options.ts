import type { CookieOptions } from "@supabase/ssr";

export const supabaseCookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production"
    && process.env.ALLOW_INSECURE_AUTH_COOKIES !== "1",
} satisfies CookieOptions;

export function hasSupabaseEnvironment(): boolean {
  try {
    getSupabaseEnvironment();
    return true;
  } catch {
    return false;
  }
}

export function getSupabaseEnvironment(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("The application service is not configured.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("The application service configuration is invalid.");
  }

  const localHost = parsedUrl.hostname === "localhost"
    || parsedUrl.hostname === "127.0.0.1"
    || parsedUrl.hostname === "[::1]";
  if ((!localHost && parsedUrl.protocol !== "https:") || isPrivilegedKey(anonKey)) {
    throw new Error("The application service configuration is invalid.");
  }

  return { url, anonKey };
}

function isPrivilegedKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;

  const encodedPayload = key.split(".")[1];
  if (!encodedPayload) return false;

  try {
    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const errors = [];

if (!url) errors.push("NEXT_PUBLIC_SUPABASE_URL is required.");
if (!publicKey) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required.");

if (url) {
  try {
    const parsed = new URL(url);
    const localHost = parsed.hostname === "localhost"
      || parsed.hostname === "127.0.0.1"
      || parsed.hostname === "[::1]";
    if (!localHost && parsed.protocol !== "https:") {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must use HTTPS outside local development.");
    }
    if (parsed.hostname === "your-project.supabase.co") {
      errors.push("NEXT_PUBLIC_SUPABASE_URL still contains the example placeholder.");
    }
  } catch {
    errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }
}

if (publicKey) {
  if (publicKey === "your-anon-or-publishable-key") {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY still contains the example placeholder.");
  }
  if (publicKey.startsWith("sb_secret_") || getJwtRole(publicKey) === "service_role") {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY must never contain a secret or service-role key.");
  }
  if (publicKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push("The public and service-role Supabase keys must be different.");
  }
}

if (
  process.env.VERCEL_ENV === "production"
  && process.env.ALLOW_INSECURE_AUTH_COOKIES === "1"
) {
  errors.push("ALLOW_INSECURE_AUTH_COOKIES cannot be enabled in production.");
}

if (errors.length > 0) {
  console.error(`Production configuration is invalid:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log("Production configuration validated.");

function getJwtRole(key) {
  const encodedPayload = key.split(".")[1];
  if (!encodedPayload) return null;

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

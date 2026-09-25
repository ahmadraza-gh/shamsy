import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adviserEmail = process.env.E2E_ADVISER_EMAIL;
const adviserPassword = process.env.E2E_ADVISER_PASSWORD;
const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;

const missingVariables = [
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
  ["E2E_ADVISER_EMAIL", adviserEmail],
  ["E2E_ADVISER_PASSWORD", adviserPassword],
  ["E2E_OWNER_EMAIL", ownerEmail],
  ["E2E_OWNER_PASSWORD", ownerPassword],
].filter(([, value]) => !value).map(([name]) => name);

if (missingVariables.length > 0) {
  console.error(
    `Test-user provisioning requires: ${missingVariables.join(", ")}.`,
  );
  process.exit(1);
}

let target;
try {
  target = new URL(url);
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  process.exit(1);
}

const localTarget = target.hostname === "localhost"
  || target.hostname === "127.0.0.1"
  || target.hostname === "[::1]";
if (!localTarget && process.env.ALLOW_REMOTE_TEST_PROVISIONING !== "1") {
  console.error(
    "Refusing to provision users on a remote project. Use a disposable test project and set ALLOW_REMOTE_TEST_PROVISIONING=1 explicitly.",
  );
  process.exit(1);
}

if (
  adviserPassword.length < 16
  || ownerPassword.length < 16
  || adviserPassword === ownerPassword
  || (!localTarget && (
    adviserEmail.endsWith(".local")
    || ownerEmail.endsWith(".local")
  ))
) {
  console.error(
    "Use distinct test passwords of at least 16 characters. Remote test projects also require non-.local email addresses.",
  );
  process.exit(1);
}

const users = [
  {
    email: adviserEmail,
    password: adviserPassword,
    role: "adviser",
  },
  {
    email: ownerEmail,
    password: ownerPassword,
    role: "owner",
  },
];

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1_000,
});

if (listError) throw listError;

for (const seedUser of users) {
  let user = listed.users.find((candidate) => candidate.email === seedUser.email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: seedUser.email,
      password: seedUser.password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: seedUser.password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    email: seedUser.email,
    role: seedUser.role,
  });
  if (profileError) throw profileError;

  console.log(`Provisioned ${seedUser.role} test account.`);
}

console.log("Test users are ready.");

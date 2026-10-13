import { writeFileSync } from "node:fs";
const env = process.env;
if (!["staging", "production"].includes(env.RELEASE_ENV))
  throw Error("Invalid release environment");
const values = JSON.parse(env.WORKER_SECRETS_JSON || "{}");
if (
  !values ||
  Array.isArray(values) ||
  typeof values !== "object" ||
  Object.values(values).some((value) => typeof value !== "string")
)
  throw Error("Worker secrets must be a string-valued object");
if ("EMAIL_MODE" in values || "INVOICING_PROVIDER" in values)
  throw Error("Provider settings belong to Wrangler environment vars");
for (const key of [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "RATE_LIMIT_SECRET",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
])
  if (typeof values[key] !== "string" || !values[key].trim())
    throw Error(`Missing Worker binding: ${key}`);
for (const key of [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "SUPABASE_DB_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
])
  if (!env[key]) throw Error(`Missing release setting: ${key}`);
for (const key of ["APP_URL", "NEXT_PUBLIC_SUPABASE_URL"])
  if (
    !env[key]?.startsWith("https://") ||
    ["localhost", "127.0.0.1"].includes(new URL(env[key]).hostname)
  )
    throw Error(`Hosted HTTPS required: ${key}`);
for (const key of ["CRON_SECRET", "RATE_LIMIT_SECRET"])
  if (values[key].length < 32) throw Error(`Binding too short: ${key}`);
if (env.RELEASE_ENV === "production")
  for (const key of [
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "FIC_ACCESS_TOKEN",
    "FIC_COMPANIES_JSON",
    "FIC_APPLICATION_ID",
  ])
    if (!values[key]?.trim()) throw Error(`Missing production binding: ${key}`);
// Build-time public values and runtime bindings must agree. Never log values.
for (const key of [
  "APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
])
  values[key] = env[key];
writeFileSync(process.argv[2], JSON.stringify(values), {
  mode: 0o600,
  flag: "wx",
});

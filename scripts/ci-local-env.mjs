import { readFileSync, writeFileSync } from "node:fs";
import { createECDH, randomBytes } from "node:crypto";
const status = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (
  !status.API_URL ||
  !["localhost", "127.0.0.1"].includes(new URL(status.API_URL).hostname)
)
  throw Error("CI requires isolated local Supabase.");
const vapid = createECDH("prime256v1");
vapid.generateKeys();
const env = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  APP_URL: "http://localhost:3100",
  EMAIL_MODE: "log",
  INVOICING_PROVIDER: "mock",
  CRON_SECRET: randomBytes(32).toString("hex"),
  RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  INVOICING_WEBHOOK_SECRET: randomBytes(32).toString("hex"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.getPublicKey().toString("base64url"),
  VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString("base64url"),
  VAPID_SUBJECT: "https://example.test/local-ci",
};
if (Object.values(env).some((v) => !v))
  throw Error("Incomplete CI credentials.");
writeFileSync(
  ".env.local",
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600, flag: "wx" },
);
writeFileSync(
  ".dev.vars",
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600, flag: "wx" },
);

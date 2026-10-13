import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const keys = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "RATE_LIMIT_SECRET",
  "RESEND_API_KEY",
  "INVOICING_WEBHOOK_SECRET",
  "FIC_ACCESS_TOKEN",
  "FIC_CLIENT_SECRET",
  "FIC_REFRESH_TOKEN",
  "VAPID_PRIVATE_KEY",
];
const secrets = keys
  .map((key) => [key, process.env[key]])
  .filter(([, value]) => value?.length >= 16);
if (!secrets.some(([key]) => key === "SUPABASE_SERVICE_ROLE_KEY"))
  throw Error("Configure server credentials before checking the client build.");
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : [join(directory, entry.name)],
  );
}
const roots = [".next/static", ".open-next/assets"].filter(existsSync);
if (roots.length !== 2)
  throw Error("Run build:cf before the client secret check.");
let count = 0;
for (const path of roots.flatMap(files)) {
  const bytes = readFileSync(path);
  count++;
  for (const [key, value] of secrets)
    if (bytes.includes(Buffer.from(value)))
      throw Error(`Server binding ${key} present in client artifact ${path}`);
}
console.log(
  `Client artifacts checked: ${count}. No configured server secrets found.`,
);

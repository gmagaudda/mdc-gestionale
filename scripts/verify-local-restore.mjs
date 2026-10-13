import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Deliberately limited to an independently created native local test stack.
// Credentials are read privately; subprocess stderr and connection URLs never
// appear in the report. It never connects to the main project database.
const args = process.argv.slice(2);
const arg = (name) => args[args.indexOf(name) + 1];
const workdir = resolve(arg("--workdir") || "");
const pgBin = arg("--pg-bin");
const credentialsFile = arg("--credentials-json");
if (!pgBin || !credentialsFile || !args.includes("--workdir"))
  throw Error("Use --workdir, --pg-bin and --credentials-json. See README.");
const config = readFileSync(join(workdir, "supabase/config.toml"), "utf8");
const project = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
const dbPort = Number(config.match(/\[db\][\s\S]*?\bport\s*=\s*(\d+)/)?.[1]);
const apiPort = Number(config.match(/\[api\][\s\S]*?\bport\s*=\s*(\d+)/)?.[1]);
if (
  !project?.startsWith("mdc-migration-check-") ||
  !dbPort ||
  dbPort === 54322 ||
  apiPort === 54321
)
  throw Error("Only a separate mdc-migration-check-* local stack is allowed.");
const raw = readFileSync(credentialsFile, "utf8");
let credentials;
for (let i = raw.indexOf("{"); i >= 0; i = raw.indexOf("{", i + 1)) {
  try {
    credentials = JSON.parse(raw.slice(i)).env;
    if (credentials) break;
  } catch {
    /* CLI preamble */
  }
}
if (!credentials?.SERVICE_ROLE_KEY)
  throw Error("Missing local credentials JSON.");
const url = new URL(credentials.API_URL);
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  Number(url.port) !== apiPort
)
  throw Error("Credentials must belong to the isolated loopback stack.");
const pg = (tool, arguments_) =>
  execFileSync(join(pgBin, tool), arguments_, {
    env: { ...process.env, PGPASSWORD: "postgres" },
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 16 * 1024 * 1024,
  });
const connection = [
  "-h",
  "127.0.0.1",
  "-p",
  String(dbPort),
  "-U",
  "supabase_admin",
];
const sql = (query, database = "postgres") =>
  pg("psql", [
    ...connection,
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-c",
    query,
  ]).trim();
const id = randomUUID(),
  brand = randomUUID(),
  batch = randomUUID();
const clone = `mdc_restore_${randomUUID().replaceAll("-", "")}`;
const folder = mkdtempSync(join(tmpdir(), "mdc-restore-"));
chmodSync(folder, 0o700);
const archive = join(folder, "database.dump");
const file = Buffer.from(`code,amount\nrestore-${id},123.45\n`);
const sha = (data) => createHash("sha256").update(data).digest("hex");
const path = `${batch}.csv`;
const db = createClient(url.href, credentials.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
let cloned = false;
let stage = "fixtures";
try {
  sql(
    `begin; insert into auth.users(id,email) values('${id}','restore-${id}@example.test'); update public.profiles set role='staff' where id='${id}'; insert into public.brands(id,name) values('${brand}','Restore snapshot'); insert into public.import_batches(id,kind,file_name,file_sha256,storage_path,size_bytes,created_by) values('${batch}','customers','restore.csv','${sha(file)}','${path}',${file.length},'${id}'); commit;`,
  );
  stage = "storage-backup";
  const uploaded = await db.storage
    .from("imports")
    .upload(path, file, { contentType: "text/csv" });
  if (uploaded.error) throw Error("Storage fixture upload failed");
  const original = await db.storage.from("imports").download(path);
  if (original.error) throw Error("Storage backup failed");
  const backupFile = join(folder, "original.csv");
  writeFileSync(backupFile, Buffer.from(await original.data.arrayBuffer()), {
    mode: 0o600,
  });
  stage = "database-backup";
  pg("pg_dump", [...connection, "-d", "postgres", "-Fc", "-f", archive]);
  chmodSync(archive, 0o600);
  sql(`create database ${clone}`);
  cloned = true;
  stage = "database-restore";
  pg("pg_restore", [...connection, "-d", clone, "--exit-on-error", archive]);
  stage = "database-checks";
  sql(
    `update public.brands set name='Changed after backup' where id='${brand}'`,
  );
  if (
    sql(`select name from public.brands where id='${brand}'`, clone) !==
    "Restore snapshot"
  )
    throw Error("Database snapshot mismatch");
  if (
    sql(
      `select file_sha256 from public.import_batches where id='${batch}'`,
      clone,
    ) !== sha(file)
  )
    throw Error("Storage metadata mismatch");
  const claims = JSON.stringify({
    sub: id,
    role: "authenticated",
    aal: "aal1",
  });
  const visible = sql(
    `begin; set local role authenticated; set local request.jwt.claims='${claims}'; select count(*) from public.brands where id='${brand}'; rollback;`,
    clone,
  );
  if (!visible.split("\n").includes("1")) throw Error("Restored RLS failed");
  stage = "storage-restore";
  const removed = await db.storage.from("imports").remove([path]);
  if (removed.error) throw Error("Storage fixture removal failed");
  const restored = await db.storage
    .from("imports")
    .upload(path, readFileSync(backupFile), { contentType: "text/csv" });
  if (restored.error) throw Error("Storage restore failed");
  const downloaded = await db.storage.from("imports").download(path);
  if (
    downloaded.error ||
    sha(Buffer.from(await downloaded.data.arrayBuffer())) !== sha(file)
  )
    throw Error("Restored bytes mismatch");
  console.log(
    JSON.stringify({
      event: "restore.verified",
      database_snapshot: true,
      auth_profiles: true,
      rls: true,
      private_storage_sha256: true,
      same_runtime_only: true,
    }),
  );
} catch {
  console.error(
    `Local restore verification failed at ${stage}. No credentials or subprocess output recorded.`,
  );
  process.exitCode = 1;
} finally {
  if (cloned) sql(`drop database ${clone} with (force)`);
  await db.storage.from("imports").remove([path]);
  sql(
    `begin; delete from public.import_batches where id='${batch}'; delete from public.brands where id='${brand}'; delete from auth.users where id='${id}'; commit;`,
  );
  rmSync(folder, { recursive: true, force: true });
}

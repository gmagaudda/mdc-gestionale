import { writeFileSync } from "node:fs";
const key = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const publicKey = Buffer.from(
  await crypto.subtle.exportKey("raw", key.publicKey),
).toString("base64url");
const privateKey = (await crypto.subtle.exportKey("jwk", key.privateKey)).d;
// Write a new, ignored owner-only file. Never emit the private key to stdout.
writeFileSync(
  ".vapid.local",
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=mailto:local-demo@example.test\n`,
  { mode: 0o600, flag: "wx" },
);
console.info(
  "Chiavi locali scritte in .vapid.local. Configura il contatto dell’operatore prima del rilascio.",
);

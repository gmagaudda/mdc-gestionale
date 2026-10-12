import "server-only";
import { z } from "zod";
const configSchema = z.object({
  publicKey: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
  privateKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  subject: z.string().refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "mailto:" && value.includes("@")) ||
        (url.protocol === "https:" && !url.username && !url.password)
      );
    } catch {
      return false;
    }
  }),
});
export function pushConfig() {
  const result = configSchema.safeParse({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  });
  return result.success ? result.data : null;
}

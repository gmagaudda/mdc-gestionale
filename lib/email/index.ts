import "server-only";
import { getTranslations } from "next-intl/server";
import { Resend } from "resend";
import { logOperation } from "@/lib/observability/log";
export async function deliverEmail(
  message: { to: string; subject: string; text: string; html?: string },
  idempotencyKey: string,
): Promise<"sent" | "logged"> {
  if (process.env.EMAIL_MODE === "log") {
    logOperation("email.logged", "ok", { logged: 1 });
    return "logged";
  }
  if (
    process.env.EMAIL_MODE !== "resend" ||
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM
  )
    throw Error("EMAIL_UNAVAILABLE");
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send(
    { from: process.env.EMAIL_FROM, ...message },
    { idempotencyKey },
  );
  if (result.error) throw Error("EMAIL_UNAVAILABLE");
  return "sent";
}
export async function sendInviteEmail(email: string, url: string) {
  const t = await getTranslations("users");
  const message = {
    to: email,
    subject: t("inviteSubject"),
    text: t("inviteBody", { url }),
  };
  if (process.env.EMAIL_MODE === "log") {
    logOperation("email.logged", "ok", { logged: 1 });
    return;
  }
  await deliverEmail(message, `invite-${await invitationDigest(url)}`);
}
async function invitationDigest(url: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(url),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

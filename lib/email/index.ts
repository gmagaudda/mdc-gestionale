import "server-only";
import { getTranslations } from "next-intl/server";
import { Resend } from "resend";
export async function deliverEmail(
  message: { to: string; subject: string; text: string; html?: string },
  idempotencyKey: string,
): Promise<"sent" | "logged"> {
  if (process.env.EMAIL_MODE === "log") {
    console.info(
      "[email:log]",
      JSON.stringify({
        kind: "appointment-reminder",
        idempotencyKey,
        rendered: !!message.html,
      }),
    );
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
    console.info("[email:log]", JSON.stringify(message));
    return;
  }
  // Real delivery is enabled after the hosted mail provider is configured.
  throw Error("EMAIL_UNAVAILABLE");
}

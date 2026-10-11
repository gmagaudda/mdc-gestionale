import "server-only";
import { getTranslations } from "next-intl/server";
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

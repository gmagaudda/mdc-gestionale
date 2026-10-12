import { buildPushPayload } from "@block65/webcrypto-web-push";
import { pushSubscriptionSchema } from "./push-schema";
import messages from "@/messages/it.json";
export async function deliverPush(
  subscription: unknown,
  deliveryId: string,
  vapid: { publicKey: string; privateKey: string; subject: string },
  transport: typeof fetch = fetch,
  kind: "reminder" | "test" = "reminder",
): Promise<{ status: "sent" | "failed" | "discarded"; expired: boolean }> {
  const parsed = pushSubscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { status: "discarded", expired: true };
  try {
    const payload = await buildPushPayload(
      {
        data: {
          title: messages.common.appName,
          body:
            kind === "test"
              ? messages.push.testMessage
              : messages.push.reminder,
          url: "/calendar",
          tag: `appointment-${deliveryId}`,
        },
        options: {
          ttl: 3600,
          urgency: "normal",
          topic: deliveryId.replace(/-/g, "").slice(0, 32),
        },
      },
      parsed.data,
      vapid,
    );
    const response = await transport(parsed.data.endpoint, {
      ...payload,
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    // Never consume or log a push-service response or subscription credential.
    await response.body?.cancel();
    const expired = response.status === 404 || response.status === 410;
    return {
      status: response.ok ? "sent" : expired ? "discarded" : "failed",
      expired,
    };
  } catch {
    return { status: "failed", expired: false };
  }
}

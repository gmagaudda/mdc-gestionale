import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfig } from "./push-config";
import { deliverPush } from "./push-delivery";
export async function sendPushReminders(period: {
  start: string;
  end: string;
}) {
  const config = pushConfig();
  const counts = {
    sent: 0,
    failed: 0,
    discarded: 0,
    configured: Boolean(config),
  };
  if (!config) return counts;
  const db = createAdminClient();
  for (let batch = 0; batch < 10; batch++) {
    const claimed = await db.rpc("claim_push_reminders", {
      p_start: period.start,
      p_end: period.end,
    });
    if (claimed.error) throw Error("Push claim unavailable");
    // Five bounded HTTP requests at a time keep a 100-device batch inside its lease.
    for (let offset = 0; offset < claimed.data.length; offset += 5) {
      await Promise.all(
        claimed.data.slice(offset, offset + 5).map(async (reminder) => {
          const result = await deliverPush(
            {
              endpoint: reminder.endpoint,
              expirationTime: null,
              keys: { p256dh: reminder.p256dh, auth: reminder.auth },
            },
            reminder.delivery_id,
            config,
          );
          const finished = await db.rpc("finish_push_reminder", {
            p_id: reminder.delivery_id,
            p_lease: reminder.lease_id,
            p_status: result.status,
            p_expired: result.expired,
          });
          if (finished.error) throw Error("Push completion unavailable");
          counts[finished.data ? result.status : "discarded"]++;
        }),
      );
    }
    if (counts.failed || claimed.data.length < 100) break;
    if (batch === 9) throw Error("Push batch limit reached");
  }
  return counts;
}

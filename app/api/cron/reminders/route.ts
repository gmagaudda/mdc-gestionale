import { createAdminClient } from "@/lib/supabase/admin";
import { tomorrowInRome, cronAuthorized } from "@/lib/calendar/reminders";
import { renderAppointmentReminder } from "@/lib/email/appointment-reminder";
import { deliverEmail } from "@/lib/email";
import { sendPushReminders } from "@/lib/pwa/push-job";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!(await cronAuthorized(request, process.env.CRON_SECRET)))
    return new Response(null, { status: 401, headers });
  const counters = { sent: 0, logged: 0, failed: 0 };
  try {
    const period = tomorrowInRome(new Date());
    const db = createAdminClient();
    for (let batch = 0; batch < 10; batch++) {
      const claimed = await db.rpc("claim_event_reminders", {
        p_start: period.start,
        p_end: period.end,
      });
      if (claimed.error) throw Error("Claim unavailable");
      for (const reminder of claimed.data) {
        let status: "sent" | "logged" | "failed" = "failed";
        try {
          const message = await renderAppointmentReminder(reminder);
          status = await deliverEmail(
            { to: reminder.email, ...message },
            `appointment-${reminder.reminder_id}`,
          );
        } catch {
          /* Record a retryable failure without logging email contents or addresses. */
        }
        const finished = await db.rpc("finish_event_reminder", {
          p_id: reminder.reminder_id,
          p_lease: reminder.lease_id,
          p_status: status,
        });
        if (finished.error || !finished.data)
          throw Error("Completion unavailable");
        counters[status]++;
      }
      if (counters.failed || claimed.data.length < 500) break;
      if (batch === 9)
        throw Error("Reminder batch limit reached; retry required");
    }
    const push = await sendPushReminders(period);
    console.info("[reminders]", JSON.stringify({ ...counters, push }));
    return Response.json(
      { ...counters, push },
      {
        status: counters.failed || push.failed ? 503 : 200,
        headers,
      },
    );
  } catch {
    return Response.json(
      { error: "REMINDERS_UNAVAILABLE" },
      { status: 503, headers },
    );
  }
}

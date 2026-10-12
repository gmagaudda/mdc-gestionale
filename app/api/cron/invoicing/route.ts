import { createAdminClient } from "@/lib/supabase/admin";
import { cronAuthorized } from "@/lib/calendar/reminders";
import { processFicWebhooks } from "@/lib/invoicing/fic/job";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: Request) {
  if (!(await cronAuthorized(request, process.env.CRON_SECRET)))
    return new Response(null, { status: 401, headers });
  if (process.env.INVOICING_PROVIDER !== "fic")
    return Response.json({ completed: 0, failed: 0 }, { headers });
  try {
    const result = await processFicWebhooks(createAdminClient());
    console.info("[invoicing]", JSON.stringify(result));
    return Response.json(result, {
      status: result.failed ? 503 : 200,
      headers,
    });
  } catch {
    return Response.json(
      { error: "INVOICING_UNAVAILABLE" },
      { status: 503, headers },
    );
  }
}

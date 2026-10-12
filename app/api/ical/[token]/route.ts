import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { calendarFeed, feedEventSchema } from "@/lib/calendar/ical";
import { hashToken, icalTokenPattern } from "@/lib/calendar/token";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!icalTokenPattern.test(token))
    return new Response(null, { status: 404, headers });
  try {
    const result = await createAdminClient().rpc("read_ical_feed", {
      p_hash: await hashToken(token),
    });
    if (result.error) throw Error("Feed unavailable");
    if (result.data === null)
      return new Response(null, { status: 404, headers });
    const events = z.array(feedEventSchema).parse(result.data);
    if (events.length > 5000)
      return new Response(null, { status: 413, headers });
    return new Response(calendarFeed(events), {
      headers: {
        ...headers,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "inline; filename=calendario.ics",
      },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}

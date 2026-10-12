import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { eventRangeSchema } from "@/modules/calendar/schema";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  if ((await getSessionUser())?.role !== "brand")
    return new Response(null, { status: 403, headers });
  const parsed = eventRangeSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) return new Response(null, { status: 400, headers });
  if (parsed.data.customer_id || parsed.data.assigned_to)
    return new Response(null, { status: 400, headers });
  const f = parsed.data;
  let q = (await createClient())
    .from("portal_events")
    .select(
      "id,brand_id,title,type,description,location,starts_at,ends_at,all_day",
    )
    .lt("starts_at", f.end)
    .gt("ends_at", f.start)
    .order("starts_at")
    .order("id")
    .limit(501);
  if (f.brand_id) q = q.eq("brand_id", f.brand_id);
  if (f.type) q = q.eq("type", f.type);
  const r = await q;
  if (r.error) return new Response(null, { status: 503, headers });
  if (r.data.length > 500) return new Response(null, { status: 413, headers });
  return Response.json(r.data, { headers });
}

import { getSessionUser } from "@/lib/auth";
import { listEvents } from "@/modules/calendar/queries";
export async function GET(request: Request) {
  if (!(await getSessionUser()))
    return new Response(null, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  const result = await listEvents(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  return result.ok
    ? Response.json(result.data, {
        headers: { "Cache-Control": "private, no-store" },
      })
    : new Response(null, {
        status: result.status,
        headers: { "Cache-Control": "private, no-store" },
      });
}

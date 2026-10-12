import { cronAuthorized } from "@/lib/calendar/reminders";
import { removeExpiredImportFiles } from "@/lib/imports/retention";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!(await cronAuthorized(request, process.env.CRON_SECRET)))
    return new Response(null, { status: 401, headers });
  try {
    const result = await removeExpiredImportFiles();
    console.info("[import-retention]", JSON.stringify(result));
    return Response.json(result, {
      headers,
      status: result.failed || result.more ? 503 : 200,
    });
  } catch {
    return Response.json(
      { error: "RETENTION_UNAVAILABLE" },
      { headers, status: 503 },
    );
  }
}

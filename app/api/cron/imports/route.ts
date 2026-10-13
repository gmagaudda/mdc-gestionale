import { logOperation } from "@/lib/observability/log";
import { cronAuthorized } from "@/lib/calendar/reminders";
import { removeExpiredImportFiles } from "@/lib/imports/retention";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!(await cronAuthorized(request, process.env.CRON_SECRET)))
    return new Response(null, { status: 401, headers });
  const started = performance.now();
  try {
    const result = await removeExpiredImportFiles();
    logOperation(
      "retention.finished",
      result.failed || result.more ? "retry" : "ok",
      { ...result, duration_ms: performance.now() - started },
    );
    return Response.json(result, {
      headers,
      status: result.failed || result.more ? 503 : 200,
    });
  } catch {
    logOperation("retention.finished", "error", {
      duration_ms: performance.now() - started,
    });
    return Response.json(
      { error: "RETENTION_UNAVAILABLE" },
      { headers, status: 503 },
    );
  }
}

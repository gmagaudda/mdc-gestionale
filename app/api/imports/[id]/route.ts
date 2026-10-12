import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || !["admin", "accounting"].includes(user.role))
    return new Response(null, { status: 403, headers });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers });
  const db = await createClient(),
    batch = await db
      .from("import_batches")
      .select("file_name,storage_path,file_removed_at")
      .eq("id", id)
      .maybeSingle();
  if (batch.error || !batch.data || batch.data.file_removed_at)
    return new Response(null, { status: 404, headers });
  const signed = await db.storage
    .from("imports")
    .createSignedUrl(batch.data.storage_path, 60, {
      download: batch.data.file_name,
    });
  return signed.error
    ? new Response(null, { status: 404, headers })
    : new Response(null, {
        status: 302,
        headers: { ...headers, Location: signed.data.signedUrl },
      });
}

import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionUser()))
    return new Response(null, { status: 401, headers });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers });
  const db = await createClient();
  const document = await db
    .from("documents")
    .select("storage_path,original_filename")
    .eq("id", id)
    .eq("ready", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (document.error) return new Response(null, { status: 503, headers });
  if (!document.data) return new Response(null, { status: 404, headers });
  const signed = await db.storage
    .from("documents")
    .createSignedUrl(document.data.storage_path, 120, {
      download: document.data.original_filename,
    });
  if (signed.error) return new Response(null, { status: 503, headers });
  return new Response(null, {
    status: 307,
    headers: { ...headers, Location: signed.data.signedUrl },
  });
}

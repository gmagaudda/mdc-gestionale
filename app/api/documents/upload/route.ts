import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { boundedForm, RequestTooLarge } from "@/lib/http/bounded-form";
import {
  documentSchema,
  maxDocumentSize,
  validateDocumentFile,
} from "@/modules/documents/schema";
const headers = { "Cache-Control": "private, no-store" };
const error = (message: string, status: number) =>
  Response.json({ error: message }, { status, headers });
export async function POST(request: Request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin)
    return error("FORBIDDEN", 403);
  const user = await getSessionUser();
  if (!user) return error("FORBIDDEN", 401);
  if (!["admin", "staff"].includes(user.role)) return error("FORBIDDEN", 403);
  try {
    const form = await boundedForm(request, maxDocumentSize + 65536);
    const parsed = documentSchema.safeParse(
      JSON.parse(String(form.get("metadata") ?? "null")),
    );
    if (!parsed.success) return error("validation", 400);
    const file = form.get("file");
    if (!(file instanceof File)) return error("file", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid = validateDocumentFile(file.name, file.type, bytes);
    if (!valid.ok)
      return error(valid.error, valid.error === "size" ? 413 : 400);
    const db = await createClient(),
      id = crypto.randomUUID(),
      value = parsed.data,
      path = `${value.brand_id}/${id}.${valid.extension}`;
    const prepared = await db
      .from("documents")
      .insert({
        ...value,
        id,
        storage_path: path,
        original_filename: file.name,
        mime_type: valid.mime,
        size_bytes: file.size,
        uploaded_by: user.id,
        customer_id: value.customer_id || null,
        order_id: value.order_id || null,
      })
      .select("id")
      .single();
    if (prepared.error) return error("saveError", 400);
    const upload = await db.storage.from("documents").upload(path, bytes, {
      contentType: valid.mime,
      upsert: false,
      cacheControl: "0",
    });
    if (upload.error) {
      await db.from("documents").delete().eq("id", id).eq("ready", false);
      return error("uploadError", 503);
    }
    const finalized = await db
      .from("documents")
      .update({ ready: true })
      .eq("id", id)
      .eq("ready", false)
      .select("id")
      .single();
    if (finalized.error) {
      const removed = await db.storage.from("documents").remove([path]);
      if (!removed.error)
        await db.from("documents").delete().eq("id", id).eq("ready", false);
      return error("uploadError", 503);
    }
    return Response.json({ id }, { status: 201, headers });
  } catch (cause) {
    return error(
      cause instanceof RequestTooLarge ? "size" : "uploadError",
      cause instanceof RequestTooLarge ? 413 : 400,
    );
  }
}

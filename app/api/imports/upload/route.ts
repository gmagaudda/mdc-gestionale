import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { boundedForm, RequestTooLarge } from "@/lib/http/bounded-form";
import { maxImportSize, validateImportFile } from "@/modules/imports/file";
const headers = { "Cache-Control": "private, no-store" };
const error = (error: string, status: number, id?: string) =>
  Response.json({ error, ...(id ? { id } : {}) }, { status, headers });
export async function POST(request: Request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    return error("FORBIDDEN", 403);
  const user = await getSessionUser();
  if (!user) return error("FORBIDDEN", 401);
  if (!["admin", "accounting"].includes(user.role))
    return error("FORBIDDEN", 403);
  try {
    const form = await boundedForm(request, maxImportSize + 65536),
      kind = z
        .enum(["customers", "orders", "budgets", "mixed", "performance"])
        .safeParse(form.get("kind"));
    if (!kind.success) return error("validation", 400);
    if (user.role === "accounting" && kind.data !== "budgets")
      return error("FORBIDDEN", 403);
    const file = form.get("file");
    if (!(file instanceof File) || file.name.length > 250)
      return error("fileType", 400);
    const bytes = new Uint8Array(await file.arrayBuffer()),
      extension = validateImportFile(file.name, bytes);
    if (!extension)
      return error(
        file.size > maxImportSize ? "fileLimit" : "fileType",
        file.size > maxImportSize ? 413 : 400,
      );
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (v) => v.toString(16).padStart(2, "0"),
    ).join("");
    const db = await createClient();
    const findPrior = () =>
      db
        .from("import_batches")
        .select("id,status,created_by")
        .eq("file_sha256", hash)
        .eq("kind", kind.data)
        .not("status", "in", "(failed,rolled_back)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    const duplicateResponse = (b: {
      id: string;
      status: string;
      created_by: string;
    }) =>
      Response.json(
        {
          error: "duplicateFile",
          id: b.id,
          resume:
            b.created_by === user.id &&
            ["uploaded", "mapped", "validated", "ready"].includes(b.status),
        },
        { status: 409, headers },
      );
    const prior = await findPrior();
    if (prior.error) return error("uploadError", 503);
    if (prior.data) return duplicateResponse(prior.data);
    const id = crypto.randomUUID(),
      path = `${id}.${extension}`,
      mime =
        extension === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv";
    const prepared = await db.rpc("start_import_batch", {
      p_id: id,
      p_kind: kind.data,
      p_filename: file.name,
      p_sha256: hash,
      p_size: file.size,
      p_retention_days: z.coerce
        .number()
        .int()
        .min(1)
        .max(3650)
        .parse(process.env.IMPORT_RETENTION_DAYS ?? "90"),
    });
    if (prepared.error) {
      if (prepared.error.code === "23505") {
        const raced = await findPrior();
        if (raced.data) return duplicateResponse(raced.data);
      }
      return error("uploadError", 400);
    }
    const uploaded = await db.storage.from("imports").upload(path, bytes, {
      contentType: mime,
      upsert: false,
      cacheControl: "0",
    });
    if (uploaded.error) {
      await db.rpc("fail_import_upload", { p_id: id });
      return error("uploadError", 503);
    }
    return Response.json({ id, hash }, { status: 201, headers });
  } catch (cause) {
    return error(
      cause instanceof RequestTooLarge ? "fileLimit" : "uploadError",
      cause instanceof RequestTooLarge ? 413 : 400,
    );
  }
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
export async function removeExpiredImportFiles() {
  const db = createAdminClient(),
    counters = { removed: 0, failed: 0 };
  const files = await db
    .from("import_batches")
    .select("id,storage_path")
    .is("file_removed_at", null)
    .lte("file_expires_at", new Date().toISOString())
    .order("file_expires_at")
    .limit(100);
  if (files.error) throw Error("Retention unavailable");
  for (const file of files.data) {
    try {
      const removed = await db.storage
        .from("imports")
        .remove([file.storage_path]);
      if (removed.error) throw Error("Storage unavailable");
      const recorded = await db.rpc("finish_import_file_retention", {
        p_id: file.id,
      });
      if (recorded.error || !recorded.data)
        throw Error("Retention completion unavailable");
      counters.removed++;
    } catch {
      counters.failed++;
    }
  }
  return { ...counters, more: files.data.length === 100 };
}

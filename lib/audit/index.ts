import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { AppError } from "@/lib/errors";
import type { Json } from "@/lib/supabase/types";

// Database row triggers record business writes atomically. This helper records
// operations without a row mutation, such as sending an invitation.
export async function logAudit(input: {
  action: string;
  tableName: string;
  recordId: string;
  before?: Json;
  after?: Json;
}) {
  await requireRole(internalRoles);
  const client = await createClient();
  const { data, error } = await client.rpc("write_audit", {
    p_action: input.action,
    p_table_name: input.tableName,
    p_record_id: input.recordId,
    p_before: input.before ?? null,
    p_after: input.after ?? null,
  });
  if (error) throw new AppError("UNAVAILABLE");
  return data;
}

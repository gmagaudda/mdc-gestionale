import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { mappingProfileSchema } from "./fields";
export async function getImportProfiles() {
  const user = await getSessionUser();
  if (!user || !["admin", "accounting"].includes(user.role))
    return { ok: false as const };
  const result = await (
    await createClient()
  )
    .from("import_profiles")
    .select("id,name,entity,sheet_name,header_row,mapping,options")
    .in(
      "entity",
      user.role === "accounting"
        ? ["budgets"]
        : ["customers", "orders", "budgets"],
    )
    .order("name")
    .limit(100);
  if (result.error) return { ok: false as const };
  const profiles = result.data.flatMap(({ id, ...record }) => {
    const parsed = mappingProfileSchema.safeParse(record);
    return parsed.success ? [{ id, ...parsed.data }] : [];
  });
  return {
    ok: true as const,
    profiles,
    invalidProfiles: result.data.length - profiles.length,
  };
}

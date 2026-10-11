import { cache } from "react";
import { uuid } from "zod";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { AppError } from "@/lib/errors";
import { hasRole, type Role } from "./roles";

export const getSessionUser = cache(async () => {
  if (!hasSupabaseConfig()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,role,full_name,email,is_active")
    .eq("id", data.user.id)
    .single();
  if (profileError || !profile?.is_active) return null;
  return profile;
});

export async function requireRole(roles: readonly Role[]) {
  const user = await getSessionUser();
  if (!user || !hasRole(user.role, roles)) throw new AppError("FORBIDDEN");
  return user;
}

export async function requireBrandAccess(brandId: string) {
  const user = await getSessionUser();
  if (!user) throw new AppError("FORBIDDEN");
  if (!uuid().safeParse(brandId).success) throw new AppError("NOT_FOUND");
  const client = await createClient();
  const { data, error } = await client.rpc("has_brand_access", {
    p_brand_id: brandId,
  });
  if (error) throw new AppError("UNAVAILABLE");
  if (!data) throw new AppError("NOT_FOUND");
  return user;
}

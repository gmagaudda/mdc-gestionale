"use server";
import { uuid } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { customerSchema, customerContactSchema } from "./schema";
export async function saveCustomer(
  id: string | null,
  input: unknown,
): Promise<ActionResult<string>> {
  await requireRole(["admin", "staff"]);
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success || (id !== null && !uuid().safeParse(id).success))
    return { ok: false, error: "validation" };
  const client = await createClient();
  const data = {
    ...parsed.data,
    city: parsed.data.billing_address.city,
    country: parsed.data.billing_address.country,
  };
  const result = id
    ? await client
        .from("customers")
        .update(data)
        .eq("id", id)
        .is("deleted_at", null)
        .select("id")
        .single()
    : await client.from("customers").insert(data).select("id").single();
  if (result.error || !result.data) return { ok: false, error: "saveError" };
  revalidatePath("/customers");
  revalidatePath(`/customers/${result.data.id}`);
  return { ok: true, data: result.data.id };
}
export async function archiveCustomer(id: string): Promise<ActionResult> {
  await requireRole(["admin", "staff"]);
  if (!uuid().safeParse(id).success) return { ok: false, error: "validation" };
  const client = await createClient();
  const { error } = await client
    .from("customers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) return { ok: false, error: "saveError" };
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true, data: undefined };
}
export async function saveCustomerContact(
  id: string | null,
  input: unknown,
): Promise<ActionResult> {
  await requireRole(["admin", "staff"]);
  const parsed = customerContactSchema.safeParse(input);
  if (!parsed.success || (id !== null && !uuid().safeParse(id).success))
    return { ok: false, error: "validation" };
  const client = await createClient();
  const result = id
    ? await client
        .from("customer_contacts")
        .update(parsed.data)
        .eq("id", id)
        .eq("customer_id", parsed.data.customer_id)
        .is("deleted_at", null)
        .select("id")
        .single()
    : await client
        .from("customer_contacts")
        .insert(parsed.data)
        .select("id")
        .single();
  if (result.error) return { ok: false, error: "saveError" };
  revalidatePath(`/customers/${parsed.data.customer_id}`);
  return { ok: true, data: undefined };
}
export async function archiveCustomerContact(
  id: string,
  customerId: string,
): Promise<ActionResult> {
  await requireRole(["admin", "staff"]);
  if (!uuid().safeParse(id).success || !uuid().safeParse(customerId).success)
    return { ok: false, error: "validation" };
  const client = await createClient();
  const { error } = await client
    .from("customer_contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .select("id")
    .single();
  if (error) return { ok: false, error: "saveError" };
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, data: undefined };
}

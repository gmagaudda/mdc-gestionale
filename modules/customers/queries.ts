import "server-only";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, type ListQuery } from "@/lib/queries/list";
export async function listCustomers(query: ListQuery) {
  const client = await createClient();
  const offset = (query.page - 1) * query.size;
  let request = client
    .from("customers")
    .select("id,legal_name,trade_name,city", { count: "exact" })
    .is("deleted_at", null)
    .order(query.sort, { ascending: query.direction === "asc" })
    .order("id")
    .range(offset, offset + query.size - 1);
  if (query.q)
    request = request.ilike("legal_name", `%${escapeLike(query.q)}%`);
  return request;
}
export async function getCustomer(id: string) {
  const client = await createClient();
  const [customer, contacts] = await Promise.all([
    client
      .from("customers")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    client
      .from("customer_contacts")
      .select("*")
      .eq("customer_id", id)
      .is("deleted_at", null)
      .order("name"),
  ]);
  return { customer, contacts };
}

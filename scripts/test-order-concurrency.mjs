import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw Error("Local fixtures only");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const session = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const check = (result) => {
  if (result.error) throw result.error;
  return result.data;
};
const ids = { orders: [] };
try {
  const email = `order-concurrency-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomUUID() + crypto.randomUUID();
  ids.user = check(
    await admin.auth.admin.createUser({ email, password, email_confirm: true }),
  ).user.id;
  check(
    await admin.from("profiles").update({ role: "staff" }).eq("id", ids.user),
  );
  check(await session.auth.signInWithPassword({ email, password }));
  ids.brand = check(
    await admin
      .from("brands")
      .insert({ name: "Concurrency fixture" })
      .select("id")
      .single(),
  ).id;
  ids.customer = check(
    await admin
      .from("customers")
      .insert({ legal_name: "Concurrency fixture" })
      .select("id")
      .single(),
  ).id;
  ids.season = check(
    await session
      .from("seasons")
      .insert({
        brand_id: ids.brand,
        code: crypto.randomUUID().slice(0, 12),
        name: "Concurrency fixture",
      })
      .select("id")
      .single(),
  ).id;
  const header = {
    brand_id: ids.brand,
    customer_id: ids.customer,
    season_id: ids.season,
    order_date: "2099-01-01",
    delivery_date: "",
    payment_terms: "",
    discount_pct: 0,
    commission_pct_override: null,
    internal_notes: "",
  };
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () =>
      session.rpc("save_order", { p_id: null, p_data: header, p_lines: [] }),
    ),
  );
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.data)
      ids.orders.push(result.value.data);
  }
  for (const result of results) {
    if (result.status === "rejected") throw result.reason;
    check(result.value);
  }
  const rows = check(
    await session.from("orders").select("number").in("id", ids.orders),
  );
  assert.equal(rows.length, 20);
  assert.equal(new Set(rows.map((row) => row.number)).size, 20);
  const numbers = rows
    .map((row) => Number(row.number.split("/")[1]))
    .sort((a, b) => a - b);
  for (let i = 1; i < numbers.length; i++)
    assert.equal(numbers[i], numbers[i - 1] + 1);
  console.info(
    "20 concurrent orders: unique consecutive annual numbers verified.",
  );
} finally {
  if (ids.orders.length) {
    check(
      await admin
        .from("order_status_history")
        .delete()
        .in("order_id", ids.orders),
    );
    check(await admin.from("order_private").delete().in("id", ids.orders));
    check(await admin.from("orders").delete().in("id", ids.orders));
  }
  if (ids.season)
    check(await admin.from("seasons").delete().eq("id", ids.season));
  if (ids.customer)
    check(await admin.from("customers").delete().eq("id", ids.customer));
  if (ids.brand) check(await admin.from("brands").delete().eq("id", ids.brand));
  if (ids.user) check(await admin.auth.admin.deleteUser(ids.user));
}

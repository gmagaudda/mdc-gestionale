import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw Error("I dati demo si possono creare solo su Supabase locale.");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw Error("Configura la chiave locale in .env.local.");
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const password = process.env.SEED_DEMO_PASSWORD ?? "Local-demo-only-42";
const check = (result) => {
  if (result.error) throw result.error;
  return result.data;
};
const accounts = check(
  await db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
).users;
const users = {};
for (const [role, name] of [
  ["admin", "Admin demo"],
  ["staff", "Staff demo"],
  ["accounting", "Amministrazione demo"],
  ["brand", "Brand demo"],
]) {
  const email = `${role}@showroom.test`;
  let user = accounts.find((account) => account.email === email);
  if (!user) {
    user = check(
      await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      }),
    ).user;
    check(
      await db
        .from("profiles")
        .update({ role, full_name: name })
        .eq("id", user.id),
    );
  }
  users[role] = user.id;
}
const brandId = "d0000000-0000-4000-8000-000000000001";
if (
  !check(await db.from("brands").select("id").eq("id", brandId).maybeSingle())
) {
  check(
    await db
      .from("brands")
      .insert({
        id: brandId,
        name: "Brand dimostrativo",
        legal_name: "Brand dimostrativo Srl",
        external_code: "DEMO-BRAND",
      }),
  );
  check(
    await db
      .from("brand_private")
      .insert({
        id: brandId,
        commission_pct: 10,
        notes: "Dati sintetici per le prove locali.",
      }),
  );
}
check(
  await db
    .from("brand_users")
    .upsert(
      { brand_id: brandId, user_id: users.brand },
      { onConflict: "brand_id,user_id", ignoreDuplicates: true },
    ),
);
const customerId = "d0000000-0000-4000-8000-000000000002";
const address = {
  street: "Via dimostrativa 1",
  postal_code: "20100",
  city: "Milano",
  province: "MI",
  country: "IT",
};
if (
  !check(
    await db.from("customers").select("id").eq("id", customerId).maybeSingle(),
  )
)
  check(
    await db
      .from("customers")
      .insert({
        id: customerId,
        legal_name: "Boutique dimostrativa Srl",
        trade_name: "Boutique demo",
        external_code: "DEMO-CUSTOMER",
        city: address.city,
        country: address.country,
        billing_address: address,
        shipping_address: address,
        notes: "Dati sintetici per le prove locali.",
      }),
  );
console.info("Dati demo locali pronti. Account:");
console.info(
  "admin@showroom.test, staff@showroom.test, accounting@showroom.test, brand@showroom.test",
);
console.info(
  "Password dei nuovi account: valore di SEED_DEMO_PASSWORD oppure Local-demo-only-42. Le password esistenti restano invariate.",
);

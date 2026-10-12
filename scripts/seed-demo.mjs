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
    await db.from("brands").insert({
      id: brandId,
      name: "Brand dimostrativo",
      legal_name: "Brand dimostrativo Srl",
      external_code: "DEMO-BRAND",
    }),
  );
  check(
    await db.from("brand_private").insert({
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
    await db.from("customers").insert({
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
// Catalog and orders use the demo staff session, with the same business guards as the app.
const staffSession = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const signIn = await staffSession.auth.signInWithPassword({
  email: "staff@showroom.test",
  password,
});
if (signIn.error) {
  console.info(
    "Catalogo demo non aggiunto: imposta SEED_DEMO_PASSWORD con la password attuale dello staff demo e ripeti il comando.",
  );
} else {
  const seasonId = "d0000000-0000-4000-8000-000000000003";
  if (
    !check(
      await db.from("seasons").select("id").eq("id", seasonId).maybeSingle(),
    )
  )
    check(
      await staffSession.from("seasons").insert({
        id: seasonId,
        brand_id: brandId,
        code: "DEMO-FW26",
        name: "Autunno inverno dimostrativo",
      }),
    );
  const products = [];
  for (const [sku, name, price] of [
    ["DEMO-CAMICIA", "Camicia dimostrativa", 3990],
    ["DEMO-PANTALONE", "Pantalone dimostrativo", 5990],
    ["DEMO-GIACCA", "Giacca dimostrativa", 12990],
  ]) {
    let product = check(
      await db.from("products").select("id").eq("sku_base", sku).maybeSingle(),
    );
    if (!product) {
      const id = check(
        await staffSession.rpc("save_product", {
          p_id: null,
          p_data: {
            brand_id: brandId,
            season_id: seasonId,
            sku_base: sku,
            name,
            description: "Articolo sintetico per le prove locali.",
            wholesale_price_cents: price,
            retail_price_cents: price * 2,
            vat_rate: 22,
            sizes: ["XS", "S", "M", "L", "XL"],
            colors: ["Blu", "Nero", "Bianco"],
          },
        }),
      );
      product = { id };
    }
    products.push(product.id);
  }
  const existing = check(
    await db
      .from("orders")
      .select("id")
      .eq("brand_id", brandId)
      .eq("customer_id", customerId)
      .limit(1),
  );
  if (!existing.length) {
    const variants = check(
      await db
        .from("product_variants")
        .select("id,product_id")
        .in("product_id", products)
        .eq("size", "M")
        .eq("color", "Blu"),
    );
    const prices = check(
      await db
        .from("products")
        .select("id,wholesale_price_cents")
        .in("id", products),
    );
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
    }).format(new Date());
    check(
      await staffSession.rpc("save_order", {
        p_id: null,
        p_data: {
          brand_id: brandId,
          customer_id: customerId,
          season_id: seasonId,
          order_date: today,
          delivery_date: "",
          payment_terms: "30 giorni data fattura",
          discount_pct: 5,
          commission_pct_override: null,
          internal_notes:
            "Ordine sintetico dimostrativo. Puoi modificarlo per provare il flusso.",
        },
        p_lines: variants.map((variant) => ({
          variant_id: variant.id,
          quantity: 3,
          unit_price_cents: prices.find(
            (product) => product.id === variant.product_id,
          ).wholesale_price_cents,
          discount_pct: 0,
        })),
      }),
    );
  }
  const demoEventId = "d0000000-0000-4000-8000-000000000004";
  if (
    !check(
      await db.from("events").select("id").eq("id", demoEventId).maybeSingle(),
    )
  ) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome",
    }).format(new Date());
    // A stable offset is computed from the date, including winter/summer time.
    const { Temporal } = await import("temporal-polyfill");
    const instant = (local) =>
      Temporal.PlainDateTime.from(local)
        .toZonedDateTime("Europe/Rome")
        .toInstant()
        .toString();
    check(
      await staffSession
        .from("events")
        .insert({
          id: demoEventId,
          title: "Presentazione campionario demo",
          type: "appointment",
          brand_id: brandId,
          customer_id: customerId,
          assigned_to: signIn.data.user.id,
          starts_at: instant(`${today}T09:00`),
          ends_at: instant(`${today}T10:00`),
          location: "Showroom dimostrativo",
          description: "Appuntamento sintetico per le prove locali.",
          visible_to_brand: true,
        }),
    );
  }
  await staffSession.auth.signOut();
}
console.info("Dati demo locali pronti. Account:");
console.info(
  "admin@showroom.test, staff@showroom.test, accounting@showroom.test, brand@showroom.test",
);
console.info(
  "Password dei nuovi account: valore di SEED_DEMO_PASSWORD oppure Local-demo-only-42. Le password esistenti restano invariate.",
);

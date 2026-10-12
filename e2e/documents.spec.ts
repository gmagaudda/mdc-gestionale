import { selectChoice } from "./helpers/navigation";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import AxeBuilder from "@axe-core/playwright";
const password = "Documents-local-fixture-42";
let email: string,
  userId: string,
  brandEmail: string,
  brandUserId: string,
  brandId: string,
  documentId: string,
  path: string;
const brandName = `Documenti ${crypto.randomUUID()}`;
const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
const brand = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
test.beforeAll(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    )
  )
    throw Error("Local fixtures only");
  const db = admin();
  email = `document-${crypto.randomUUID()}@example.test`;
  brandEmail = `document-brand-${crypto.randomUUID()}@example.test`;
  userId = (
    await db.auth.admin.createUser({ email, password, email_confirm: true })
  ).data.user!.id;
  brandUserId = (
    await db.auth.admin.createUser({
      email: brandEmail,
      password,
      email_confirm: true,
    })
  ).data.user!.id;
  await db
    .from("profiles")
    .update({ role: "staff", full_name: "Persona documenti" })
    .eq("id", userId);
  brandId = (
    await db.from("brands").insert({ name: brandName }).select("id").single()
  ).data!.id;
  await db
    .from("brand_users")
    .insert({ brand_id: brandId, user_id: brandUserId });
});
test.afterAll(async () => {
  const db = admin();
  if (brandId) {
    const own = await db
      .from("documents")
      .select("storage_path")
      .eq("brand_id", brandId);
    if (own.data?.length)
      await db.storage
        .from("documents")
        .remove(own.data.map((row) => row.storage_path));
  }
  if (brandId) await db.from("documents").delete().eq("brand_id", brandId);
  if (brandId) await db.from("brands").delete().eq("id", brandId);
  if (userId) await db.auth.admin.deleteUser(userId);
  if (brandUserId) await db.auth.admin.deleteUser(brandUserId);
});
test("uploads validates downloads shares and archives a private document", async ({
  page,
  request,
  browser,
}, info) => {
  const errors: string[] = [];
  expect((await request.post("/api/documents/upload")).status()).toBe(401);
  expect(
    (
      await request.get(
        "/api/documents/00000000-0000-4000-8000-000000000001/download",
      )
    ).status(),
  ).toBe(401);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toBeVisible();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("the server responded with a status of 400")
    )
      errors.push(message.text());
  });
  await page.goto("/documents/new");
  await page
    .getByRole("button", { name: "Carica documento", exact: true })
    .click();
  await expect(page.getByLabel("Nome", { exact: true })).toBeFocused();
  await page
    .getByLabel("Nome", { exact: true })
    .fill("Catalogo campionario prova");
  await page
    .getByRole("searchbox", { name: "Cerca Brand", exact: true })
    .fill(brandName);
  await selectChoice(page, "Brand", brandName);
  const file = page.getByLabel("File", { exact: true });
  await file.setInputFiles({
    name: "false.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("<html>not a PDF</html>"),
  });
  await page
    .getByRole("button", { name: "Carica documento", exact: true })
    .click();
  await expect(file).toBeFocused();
  // Audit the settled message, rather than an intermediate opacity frame.
  await expect
    .poll(() =>
      page.getByRole("alert").evaluateAll((alerts) =>
        alerts.every((alert) =>
          [alert, ...alert.querySelectorAll("span")].every((node) => {
            const style = getComputedStyle(node);
            return (
              (style.opacity === "1" && style.filter === "none") ||
              (style.opacity === "1" && style.filter === "blur(0px)")
            );
          }),
        ),
      ),
    )
    .toBe(true);
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page
      .getByText(
        "Seleziona un PDF, PNG o JPEG valido. Estensione e contenuto devono corrispondere.",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  expect(
    (await admin().from("documents").select("id").eq("brand_id", brandId)).data,
  ).toHaveLength(0);
  const pdf = await PDFDocument.create();
  if (info.project.name === "desktop") {
    const oversized = await page.request.post("/api/documents/upload", {
      multipart: {
        metadata: JSON.stringify({
          name: "Too large",
          kind: "other",
          brand_id: brandId,
          shared_with_brand: false,
        }),
        file: {
          name: "large.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
        },
      },
    });
    expect(oversized.status()).toBe(413);
    expect(
      (
        await page.request.post("/api/documents/upload", {
          headers: { Origin: "https://untrusted.example" },
        })
      ).status(),
    ).toBe(403);
  }
  pdf.addPage().drawText("Local document fixture");
  const bytes = await pdf.save();
  if (info.project.name === "desktop") {
    const fullSize = Buffer.alloc(10 * 1024 * 1024, " ");
    Buffer.from(bytes).copy(fullSize);
    const boundary = await page.request.post("/api/documents/upload", {
      multipart: {
        metadata: JSON.stringify({
          name: "Boundary fixture",
          kind: "other",
          brand_id: brandId,
          shared_with_brand: false,
        }),
        file: {
          name: "boundary.pdf",
          mimeType: "application/pdf",
          buffer: fullSize,
        },
      },
    });
    expect(boundary.status()).toBe(201);
    const boundaryId = (await boundary.json()).id;
    expect(
      (
        await admin()
          .from("documents")
          .select("size_bytes,ready")
          .eq("id", boundaryId)
          .single()
      ).data,
    ).toMatchObject({ size_bytes: fullSize.length, ready: true });
  }
  await file.setInputFiles({
    name: "catalogo-prova.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
  await page
    .getByRole("button", { name: "Carica documento", exact: true })
    .click();
  await expect(page).toHaveURL(/\/documents\/[a-f0-9-]+\?saved=1$/);
  documentId = new URL(page.url()).pathname.split("/").pop()!;
  const record = await admin()
    .from("documents")
    .select("storage_path,ready")
    .eq("id", documentId)
    .single();
  path = record.data!.storage_path;
  expect(record.data!.ready).toBe(true);
  const outsider = brand();
  await outsider.auth.signInWithPassword({ email: brandEmail, password });
  expect(
    (await outsider.from("documents").select("id").eq("id", documentId)).data,
  ).toHaveLength(0);
  expect(
    (await outsider.storage.from("documents").download(path)).error,
  ).toBeTruthy();
  expect(
    (await outsider.storage.from("documents").createSignedUrl(path, 120)).error,
  ).toBeTruthy();
  expect(
    (
      await request.get(
        outsider.storage.from("documents").getPublicUrl(path).data.publicUrl,
      )
    ).ok(),
  ).toBe(false);
  const link = await page.request.get(`/api/documents/${documentId}/download`, {
    maxRedirects: 0,
  });
  expect(link.status()).toBe(307);
  expect(link.headers()["cache-control"]).toContain("no-store");
  const signed = link.headers().location;
  const token = new URL(signed).searchParams.get("token")!;
  const claims = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString(),
  );
  expect(claims.exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(105);
  expect(claims.exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(120);
  const download = await request.get(signed);
  expect(download.status()).toBe(200);
  expect((await download.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page
    .getByRole("link", { name: "Modifica documento", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Condividi con il brand", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Salva modifiche", exact: true })
    .click();
  await expect(page).toHaveURL(/\?saved=1$/);
  expect(
    (await outsider.storage.from("documents").download(path)).error,
  ).toBeNull();
  const brandContext = await browser.newContext();
  const brandPage = await brandContext.newPage();
  await brandPage.goto(new URL("/login", page.url()).href);
  await brandPage.getByLabel("Email", { exact: true }).fill(brandEmail);
  await brandPage.getByLabel("Password", { exact: true }).fill(password);
  await brandPage.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    brandPage.getByRole("button", { name: "Esci", exact: true }),
  ).toBeVisible();
  expect(
    (
      await brandPage.request.get(`/api/documents/${documentId}/download`, {
        maxRedirects: 0,
      })
    ).status(),
  ).toBe(307);
  expect((await brandPage.request.post("/api/documents/upload")).status()).toBe(
    403,
  );
  for (const theme of ["Chiaro", "Scuro"]) {
    if (theme === "Chiaro")
      await page
        .locator("summary")
        .filter({ hasText: "Preferenze utente" })
        .click();
    await page.getByRole("button", { name: theme, exact: true }).click();
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  }
  await page.screenshot({
    path: info.outputPath("document.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Archivia documento", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Annulla", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("button", { name: "Conferma archiviazione", exact: true })
    .click();
  await expect(page).toHaveURL(/\/documents$/);
  expect(
    (await outsider.storage.from("documents").download(path)).error,
  ).toBeTruthy();
  expect(
    (
      await brandPage.request.get(`/api/documents/${documentId}/download`, {
        maxRedirects: 0,
      })
    ).status(),
  ).toBe(404);
  await brandContext.close();
  expect(errors).toEqual([]);
});

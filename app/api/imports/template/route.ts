import { getSessionUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { exportXlsx } from "@/lib/xlsx";
import { canonicalFields } from "@/modules/imports/fields";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const user = await getSessionUser();
  if (!user || !["admin", "accounting"].includes(user.role))
    return new Response(null, { status: 403, headers });
  const t = await getTranslations("imports"),
    entities =
      user.role === "accounting"
        ? ["budgets" as const]
        : (["customers", "orders", "budgets"] as const);
  const bytes = await exportXlsx(
    entities.map((entity) => ({
      name: t(`entities.${entity}`),
      fields: canonicalFields[entity].map((f) => t(`fields.${f.key}`)),
      rows: [],
    })),
  );
  return new Response(bytes, {
    headers: {
      ...headers,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modello-importazione.xlsx"',
    },
  });
}

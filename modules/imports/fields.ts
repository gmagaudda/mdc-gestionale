import { z } from "zod";
import { matchKey } from "./normalize";
import type { ImportCell } from "./parser";
export const importEntities = ["customers", "orders", "budgets"] as const;
export type ImportEntity = (typeof importEntities)[number];
export type FieldType =
  | "text"
  | "money"
  | "date"
  | "quantity"
  | "percentage"
  | "email"
  | "vat"
  | "taxCode";
export type CanonicalField = {
  key: string;
  type: FieldType;
  required: boolean;
  synonyms: readonly string[];
};
const field = (
  key: string,
  type: FieldType,
  required: boolean,
  ...synonyms: string[]
): CanonicalField => ({ key, type, required, synonyms });
export const canonicalFields: Record<ImportEntity, readonly CanonicalField[]> =
  {
    customers: [
      field(
        "external_code",
        "text",
        false,
        "Codice negozio",
        "Codice cliente",
        "ID cliente",
      ),
      field(
        "legal_name",
        "text",
        true,
        "Ragione sociale",
        "CLIENTI",
        "Nome negozio",
        "Negozio",
      ),
      field("trade_name", "text", false, "Insegna", "Nome commerciale"),
      field("vat_number", "vat", false, "P.IVA", "Partita IVA", "VAT"),
      field("tax_code", "taxCode", false, "Codice fiscale", "CF"),
      field("address", "text", false, "Indirizzo", "Via"),
      field("postal_code", "text", false, "CAP", "Codice postale"),
      field("city", "text", false, "Città", "CITTA", "Comune"),
      field("province", "text", false, "Provincia"),
      field("country", "text", false, "Paese", "Nazione", "STATO"),
      field("email", "email", false, "Email", "E-mail"),
      field("phone", "text", false, "Telefono", "Tel"),
      field("representative", "text", false, "Commerciale", "Agente"),
      field("area", "text", false, "Area"),
      field("category", "text", false, "Categoria"),
      field(
        "payment_terms",
        "text",
        false,
        "Condizioni di pagamento",
        "Pagamento",
      ),
      field("sdi_code", "text", false, "Codice SDI", "SDI"),
      field("pec", "email", false, "PEC"),
      field("notes", "text", false, "Note"),
    ],
    orders: [
      field(
        "external_ref",
        "text",
        false,
        "Riferimento ordine",
        "Numero ordine",
        "Codice ordine",
      ),
      field("order_date", "date", true, "Data ordine", "Data"),
      field(
        "customer",
        "text",
        true,
        "Negozio",
        "Cliente",
        "Codice negozio",
        "CLIENTI",
      ),
      field("brand", "text", true, "Brand", "Marchio"),
      field("season", "text", true, "Stagione", "Season"),
      field("delivery_date", "date", false, "Data consegna", "Consegna"),
      field("status", "text", false, "Stato ordine"),
      field("discount_pct", "percentage", false, "Sconto ordine"),
      field("total_cents", "money", false, "Totale ordine", "Importo ordine"),
      field("notes", "text", false, "Note"),
      field("sku", "text", false, "SKU", "Codice articolo", "Articolo"),
      field(
        "product_name",
        "text",
        false,
        "Descrizione",
        "Descrizione articolo",
        "Nome prodotto",
      ),
      field("color", "text", false, "Colore"),
      field("size", "text", false, "Taglia"),
      field("quantity", "quantity", false, "Quantità", "Pezzi", "Qta"),
      field("unit_price_cents", "money", false, "Prezzo unitario", "Prezzo"),
      field("line_discount_pct", "percentage", false, "Sconto", "Sconto riga"),
      field(
        "line_net_cents",
        "money",
        false,
        "Importo netto di riga",
        "Netto riga",
      ),
      field("vat_rate", "percentage", false, "IVA", "Aliquota IVA"),
    ],
    budgets: [
      field("brand", "text", true, "Brand", "Marchio"),
      field("season", "text", false, "Stagione", "Season"),
      field(
        "customer",
        "text",
        false,
        "Negozio",
        "Cliente",
        "Codice negozio",
        "CLIENTI",
      ),
      field("amount_cents", "money", true, "Importo budget", "Budget", "BDG"),
      field("period_start", "date", true, "Inizio periodo", "Data inizio"),
      field("period_end", "date", true, "Fine periodo", "Data fine"),
      field("notes", "text", false, "Note"),
    ],
  };
export function suggestMapping(
  headers: ImportCell[],
  entity: ImportEntity,
): Record<string, number | null> {
  return Object.fromEntries(
    canonicalFields[entity].map((f) => {
      const keys = [f.key, ...f.synonyms].map(matchKey);
      const candidates = headers.flatMap((h, index) =>
        keys.includes(matchKey(h)) ? [index] : [],
      );
      return [f.key, candidates.length === 1 ? candidates[0] : null];
    }),
  );
}
const scalar = z.union([
  z.string().max(10000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export const mappingProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    entity: z.enum(importEntities),
    sheet_name: z.string().min(1).max(100),
    header_row: z.number().int().min(1).max(1000),
    mapping: z.record(z.string(), z.number().int().min(0).max(127).nullable()),
    options: z
      .object({
        defaults: z.record(z.string(), scalar).default({}),
        numberFormat: z.enum(["it", "en"]).default("it"),
        dateFormat: z.enum(["dmy", "ymd"]).default("dmy"),
        percentageScale: z.enum(["percent", "ratio"]).default("percent"),
        granularity: z
          .enum(["order_lines", "order_totals"])
          .default("order_lines"),
        mode: z.enum(["upsert", "insert_only"]).default("insert_only"),
        initialStatus: z.enum(["draft", "confirmed"]).default("draft"),
        allowCreateSeasons: z.boolean().default(false),
      })
      .strict(),
  })
  .strict()
  .superRefine((p, ctx) => {
    for (const key of ["mapping", "options"] as const)
      if (new TextEncoder().encode(JSON.stringify(p[key])).length > 16384)
        ctx.addIssue({ code: "custom", path: [key], message: "profileSize" });
    const keys = new Set(canonicalFields[p.entity].map((f) => f.key));
    for (const key of [
      ...Object.keys(p.mapping),
      ...Object.keys(p.options.defaults),
    ])
      if (!keys.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["mapping", key],
          message: "unknownField",
        });
  });
export type MappingProfile = z.infer<typeof mappingProfileSchema>;

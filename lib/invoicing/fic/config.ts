import { z } from "zod";
import { InvoicingError } from "../types";
export const ficCompanySchema = z.strictObject({
  companyId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  supplierVat: z.string().regex(/^(IT)?\d{11}$/),
  numeration: z.string().min(1).max(30),
  vatIds: z.record(
    z.string().regex(/^\d{1,3}(\.\d{1,2})?$/),
    z.number().int().nonnegative(),
  ),
});
export const ficCompaniesSchema = z.record(z.uuid(), ficCompanySchema);
export type FicCompany = z.infer<typeof ficCompanySchema>;
export function readFicCompanies(value: string | undefined) {
  try {
    const map = ficCompaniesSchema.parse(JSON.parse(value ?? ""));
    if (!Object.keys(map).length) throw Error();
    return map;
  } catch {
    throw new InvoicingError("unavailable");
  }
}
export function normalizeVat(value: string) {
  return value.trim().toUpperCase().replace(/^IT/, "");
}

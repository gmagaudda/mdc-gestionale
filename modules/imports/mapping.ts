import {
  canonicalFields,
  mappingProfileSchema,
  suggestMapping,
  type ImportEntity,
  type MappingProfile,
} from "./fields";
import type { ParsedSheet } from "./parser";
export function inferMappingProfile(
  sheet: ParsedSheet,
  allowed: readonly ImportEntity[],
): MappingProfile {
  if (!allowed.length) throw Error("noEntities");
  let best = {
    score: -1,
    entity: allowed[0],
    header: sheet.rows[0]?.number ?? 1,
    mapping: {} as Record<string, number | null>,
  };
  for (const row of sheet.rows.filter((r) => r.number <= 1000).slice(0, 50))
    for (const entity of allowed) {
      const mapping = suggestMapping(row.values, entity),
        score = canonicalFields[entity].reduce(
          (sum, f) =>
            sum + (mapping[f.key] !== null ? (f.required ? 3 : 1) : 0),
          0,
        );
      if (score > best.score)
        best = { score, entity, header: row.number, mapping };
    }
  return mappingProfileSchema.parse({
    name: sheet.name,
    entity: best.entity,
    sheet_name: sheet.name,
    header_row: best.header,
    mapping: best.mapping,
    options: { mode: best.entity === "orders" ? "insert_only" : "upsert" },
  });
}

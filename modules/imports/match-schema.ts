import { z } from "zod";
export const matchKindSchema = z.enum([
  "customer",
  "brand",
  "season",
  "variant",
]);
export const matchChoiceSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("link"),
      type: z.enum(["existing", "row"]),
      id: z.uuid(),
    })
    .strict(),
  z.object({ action: z.literal("create") }).strict(),
  z.object({ action: z.literal("ignore") }).strict(),
]);
export const matchingReportSchema = z.object({
  items: z.array(
    z.object({
      kind: matchKindSchema,
      subject: z.array(z.string().max(200)).max(5),
      row_id: z.uuid(),
      choice: z
        .discriminatedUnion("action", [
          z.object({
            action: z.literal("link"),
            type: z.enum(["existing", "row"]),
            id: z.uuid(),
          }),
          z.object({
            action: z.literal("create"),
            created_id: z.uuid().optional(),
          }),
          z.object({ action: z.literal("ignore") }),
        ])
        .nullable(),
      can_create: z.boolean(),
      candidates: z.array(
        z.object({
          type: z.enum(["existing", "row"]),
          id: z.uuid(),
          label: z.string(),
          exact: z.boolean(),
        }),
      ),
    }),
  ),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
});
export type MatchingReport = z.infer<typeof matchingReportSchema>;

import { object, string, uuid, iso, literal, type infer as Infer } from "zod";
const date = iso.date().or(literal(""));
export const seasonSchema = object({
  brand_id: uuid(),
  code: string().trim().min(1).max(30),
  name: string().trim().min(1).max(200),
  campaign_start: date,
  campaign_end: date,
  delivery_start: date,
  delivery_end: date,
}).superRefine((value, ctx) => {
  for (const [start, end] of [
    ["campaign_start", "campaign_end"],
    ["delivery_start", "delivery_end"],
  ] as const)
    if (value[start] && value[end] && value[start] > value[end])
      ctx.addIssue({ code: "custom", path: [end], message: "dateRange" });
});
export type SeasonValues = Infer<typeof seasonSchema>;
export const emptySeason: SeasonValues = {
  brand_id: "",
  code: "",
  name: "",
  campaign_start: "",
  campaign_end: "",
  delivery_start: "",
  delivery_end: "",
};

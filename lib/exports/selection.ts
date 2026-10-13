import { z } from "zod";
export const exportSelectionSchema = z
  .string()
  .min(1)
  .transform((value) => value.split(","))
  .pipe(z.array(z.uuid()).min(1).max(500))
  .transform((ids) => [...new Set(ids)])
  .optional();

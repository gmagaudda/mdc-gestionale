import { z } from "zod";
export const documentKinds = [
  "catalog",
  "lookbook",
  "price_list",
  "order_confirmation",
  "contract",
  "other",
] as const;
export const documentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(documentKinds),
  brand_id: z.uuid(),
  customer_id: z.union([z.literal(""), z.uuid()]).default(""),
  order_id: z.union([z.literal(""), z.uuid()]).default(""),
  shared_with_brand: z.boolean(),
});
export type DocumentInput = z.infer<typeof documentSchema>;
export const maxDocumentSize = 10 * 1024 * 1024;
export const acceptedDocumentTypes = ".pdf,.png,.jpg,.jpeg";
export function validateDocumentFile(
  name: string,
  mime: string,
  bytes: Uint8Array,
) {
  if (
    !name ||
    name.length > 250 ||
    Array.from(name).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    return { ok: false as const, error: "filename" };
  if (!bytes.length || bytes.length > maxDocumentSize)
    return { ok: false as const, error: "size" };
  const extension = name.split(".").pop()?.toLowerCase();
  const matches = (signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  if (
    extension === "pdf" &&
    mime === "application/pdf" &&
    matches([0x25, 0x50, 0x44, 0x46, 0x2d])
  )
    return { ok: true as const, extension: "pdf", mime };
  if (
    extension === "png" &&
    mime === "image/png" &&
    matches([137, 80, 78, 71, 13, 10, 26, 10])
  )
    return { ok: true as const, extension: "png", mime };
  if (
    (extension === "jpg" || extension === "jpeg") &&
    mime === "image/jpeg" &&
    matches([255, 216, 255])
  )
    return { ok: true as const, extension: "jpg", mime };
  return { ok: false as const, error: "type" };
}

import { expect, it } from "vitest";
import { inviteSchema, userSchema } from "./schema";
it("requires a brand for an external invitation and forbids memberships on internal roles", () => {
  const data = {
    email: "staff@example.test",
    full_name: "Staff",
    role: "staff",
    is_active: true,
    brand_ids: [],
  };
  expect(inviteSchema.safeParse(data).success).toBe(true);
  expect(inviteSchema.safeParse({ ...data, role: "brand" }).success).toBe(
    false,
  );
  const id = "00000000-0000-4000-8000-000000000001";
  expect(
    inviteSchema.safeParse({ ...data, role: "brand", brand_ids: [id] }).success,
  ).toBe(true);
  expect(userSchema.safeParse({ ...data, brand_ids: [id] }).success).toBe(
    false,
  );
  expect(inviteSchema.safeParse({ ...data, role: "owner" }).success).toBe(
    false,
  );
});

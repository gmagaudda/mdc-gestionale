import { describe, expect, it } from "vitest";
import { emailSchema, loginSchema, passwordSchema } from "./schema";
describe("authentication validation", () => {
  it("rejects malformed email and blank login password", () => {
    expect(emailSchema.safeParse({ email: "bad" }).success).toBe(false);
    expect(
      loginSchema.safeParse({ email: "test@example.test", password: "" })
        .success,
    ).toBe(false);
  });
  it("normalizes email and enforces matching passwords and limits", () => {
    expect(emailSchema.parse({ email: "TEST@example.test" }).email).toBe(
      "test@example.test",
    );
    expect(
      passwordSchema.safeParse({ password: "long-password", confirm: "other" })
        .success,
    ).toBe(false);
    expect(
      passwordSchema.safeParse({ password: "short", confirm: "short" }).success,
    ).toBe(false);
    expect(
      passwordSchema.safeParse({
        password: "x".repeat(129),
        confirm: "x".repeat(129),
      }).success,
    ).toBe(false);
    expect(
      passwordSchema.safeParse({
        password: "long-password",
        confirm: "long-password",
      }).success,
    ).toBe(true);
  });
});

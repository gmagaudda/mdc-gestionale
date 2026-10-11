import { describe, expect, it } from "vitest";
import { hasRole, homeForRole, safeNext, type Role } from "./roles";
describe("role destinations and permissions", () => {
  for (const role of ["admin", "staff", "accounting", "brand"] as Role[]) {
    it(`routes ${role} and honors allowed roles`, () => {
      expect(homeForRole(role)).toBe(
        role === "brand" ? "/portal/dashboard" : "/dashboard",
      );
      expect(hasRole(role, [role])).toBe(true);
      expect(hasRole(role, [])).toBe(false);
    });
  }
  it("rejects external and encoded redirect destinations", () => {
    for (const value of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/%2fevil.test",
      "/%5cevil.test",
      "/%0devil.test",
      "/%",
      undefined,
    ])
      expect(safeNext(value, "/login")).toBe("/login");
    expect(safeNext("/orders?page=2")).toBe("/orders?page=2");
  });
});

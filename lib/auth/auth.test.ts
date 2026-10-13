import { beforeEach, expect, it, vi } from "vitest";
const { getUser, single, rpc, getAuthenticatorAssuranceLevel } = vi.hoisted(
  () => ({
    getUser: vi.fn(),
    single: vi.fn(),
    rpc: vi.fn(),
    getAuthenticatorAssuranceLevel: vi.fn(),
  }),
);
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: () => true }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, mfa: { getAuthenticatorAssuranceLevel } },
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}));
import { getSessionUser, requireRole, requireBrandAccess } from "./index";
beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "one" } }, error: null });
  getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: "aal2" },
    error: null,
  });
});
it("denies admin sessions at aal1 and when MFA cannot be verified", async () => {
  single.mockResolvedValue({
    data: { id: "one", role: "admin", is_active: true },
    error: null,
  });
  getAuthenticatorAssuranceLevel.mockResolvedValueOnce({
    data: { currentLevel: "aal1" },
    error: null,
  });
  expect(await getSessionUser()).toBeNull();
  getAuthenticatorAssuranceLevel.mockResolvedValueOnce({
    data: null,
    error: {},
  });
  expect(await getSessionUser()).toBeNull();
});
it("rejects absent, invalid and inactive identities", async () => {
  getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect(await getSessionUser()).toBeNull();
  getUser.mockResolvedValueOnce({ data: { user: { id: "one" } }, error: {} });
  expect(await getSessionUser()).toBeNull();
  single.mockResolvedValueOnce({ data: { is_active: false }, error: null });
  expect(await getSessionUser()).toBeNull();
});
for (const role of ["admin", "staff", "accounting", "brand"] as const)
  it(`authorizes only allowed roles for ${role}`, async () => {
    single.mockResolvedValue({
      data: { id: "one", role, is_active: true },
      error: null,
    });
    expect((await requireRole([role])).role).toBe(role);
    await expect(requireRole([])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
for (const role of ["admin", "staff", "accounting", "brand"] as const)
  it(`checks brand access and database errors for ${role}`, async () => {
    single.mockResolvedValue({
      data: { id: "one", role, is_active: true },
      error: null,
    });
    const id = "00000000-0000-4000-8000-000000000001";
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect((await requireBrandAccess(id)).role).toBe(role);
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(requireBrandAccess(id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    rpc.mockResolvedValueOnce({ data: null, error: {} });
    await expect(requireBrandAccess(id)).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
    await expect(requireBrandAccess("invalid")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

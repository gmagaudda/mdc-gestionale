import { expect, it, vi } from "vitest";
const { rpc, requireRole } = vi.hoisted(() => ({
  rpc: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));
vi.mock("@/lib/auth", () => ({ requireRole }));
import { logAudit } from "./index";
it("requires internal role and derives actor in the database", async () => {
  rpc.mockResolvedValue({ data: "audit-id", error: null });
  expect(
    await logAudit({
      action: "invite",
      tableName: "profiles",
      recordId: "one",
    }),
  ).toBe("audit-id");
  expect(requireRole).toHaveBeenCalledWith(["admin", "staff", "accounting"]);
  expect(rpc).toHaveBeenCalledWith("write_audit", {
    p_action: "invite",
    p_table_name: "profiles",
    p_record_id: "one",
    p_before: null,
    p_after: null,
  });
});
it("maps database errors to a stable error", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "private details" } });
  await expect(
    logAudit({ action: "invite", tableName: "profiles", recordId: "one" }),
  ).rejects.toMatchObject({ code: "UNAVAILABLE" });
});

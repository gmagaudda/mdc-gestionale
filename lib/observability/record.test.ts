import { describe, expect, it } from "vitest";
import { operationalLog } from "./record";
describe("operational logs", () => {
  it("drops sensitive fields even if passed by an untyped caller", () => {
    const input = {
      sent: 2,
      email: "private@example.test",
      token: "secret",
      payload: { private: true },
    };
    const record = operationalLog("email.logged", "ok", input);
    expect(record).toMatchObject({
      event: "email.logged",
      status: "ok",
      sent: 2,
    });
    expect(JSON.stringify(record)).not.toMatch(/private|secret|payload|token/);
  });
  it("rejects invalid counters", () => {
    expect(() =>
      operationalLog("retention.finished", "error", { failed: -1 }),
    ).toThrow();
  });
});

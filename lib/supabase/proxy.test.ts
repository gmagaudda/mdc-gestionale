import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isProtectedPath, updateSession } from "./proxy";

describe("protected routes", () => {
  it("covers internal and portal routes", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/orders/123")).toBe(true);
    expect(isProtectedPath("/portal/orders")).toBe(true);
    expect(isProtectedPath("/login")).toBe(false);
  });

  it("redirects without a session or Supabase configuration", async () => {
    const response = await updateSession(
      new NextRequest("http://localhost:3000/dashboard"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fdashboard",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});

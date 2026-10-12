import { describe, it, expect } from "vitest";
import {
  FIC_WEBHOOK_PUBLIC_KEY,
  verifyFicJwt,
  verifyFicNotification,
  ficVerificationResponse,
} from "./webhook";
import { FIC_ORIGIN } from "./http";
import { ficFixtureWebhook } from "../test-fixtures-fic";
const now = 1800000000000;
function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
async function fixture() {
  const keys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const publicKey = btoa(
    String.fromCharCode(
      ...new Uint8Array(await crypto.subtle.exportKey("spki", keys.publicKey)),
    ),
  );
  const options = { ...ficFixtureWebhook, publicKey, now: () => now };
  const event = {
    id: "198:synthetic-event",
    source: FIC_ORIGIN,
    specversion: "1.0",
    type: "it.fattureincloud.webhooks.issued_documents.invoices.update",
    subject: "company:12345",
    time: new Date(now).toISOString(),
    data: { ids: [500] },
  };
  const claims = {
    iss: FIC_ORIGIN,
    aud: [options.audience],
    iat: now / 1000,
    exp: now / 1000 + 10800,
    sub: event.subject,
    jti: event.id,
    aid: 9876,
  };
  async function token(
    payload: unknown = claims,
    header: unknown = { alg: "ES256", typ: "JWT" },
  ) {
    const head = base64(new TextEncoder().encode(JSON.stringify(header))),
      body = base64(new TextEncoder().encode(JSON.stringify(payload)));
    const sig = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keys.privateKey,
      new TextEncoder().encode(`${head}.${body}`),
    );
    return `${head}.${body}.${base64(new Uint8Array(sig))}`;
  }
  const request = async (body: unknown = event, payload: unknown = claims) =>
    new Request(options.audience, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await token(payload)}`,
        "Content-Type": "application/cloudevents+json",
      },
      body: JSON.stringify(body),
    });
  return { options, event, claims, token, request };
}
describe("FIC ES256 webhook authentication", () => {
  it("imports the exact official P-256 public key", async () => {
    await expect(
      crypto.subtle.importKey(
        "spki",
        Uint8Array.from(atob(FIC_WEBHOOK_PUBLIC_KEY.replace(/\s/g, "")), (c) =>
          c.charCodeAt(0),
        ),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      ),
    ).resolves.toBeDefined();
  });
  it("accepts structured and binary notifications and deduplicates IDs", async () => {
    const f = await fixture();
    expect(
      await verifyFicNotification(
        await f.request({ ...f.event, data: { ids: [500, 500] } }),
        f.options,
      ),
    ).toMatchObject({ companyId: 12345, ids: [500] });
    const headers = new Headers({
      Authorization: `Bearer ${await f.token()}`,
      "Content-Type": "application/json",
    });
    for (const field of [
      "id",
      "source",
      "specversion",
      "type",
      "subject",
      "time",
    ] as const)
      headers.set(`ce-${field}`, f.event[field]);
    expect(
      await verifyFicNotification(
        new Request(f.options.audience, {
          method: "POST",
          headers,
          body: JSON.stringify({ data: { ids: [500] } }),
        }),
        f.options,
      ),
    ).toMatchObject({ ids: [500] });
  });
  it("handles authenticated welcome and subscription verification", async () => {
    const f = await fixture();
    expect(
      (
        await verifyFicNotification(
          await f.request({
            ...f.event,
            type: "it.fattureincloud.webhooks.subscriptions.welcome",
            data: {},
          }),
          f.options,
        )
      ).ids,
    ).toEqual([]);
    const challenge = "a".repeat(64);
    const headers = {
      Authorization: `Bearer ${await f.token()}`,
      "x-fic-verification-challenge": challenge,
    };
    expect(
      await ficVerificationResponse(
        new Request(f.options.audience, { headers }),
        f.options,
      ),
    ).toEqual({ verification: challenge });
    expect(
      await ficVerificationResponse(
        new Request(
          `${f.options.audience}?x-fic-verification-challenge=${challenge}`,
          { headers: { Authorization: headers.Authorization } },
        ),
        f.options,
      ),
    ).toEqual({ verification: challenge });
  });
  it.each([
    "expired",
    "audience",
    "application",
    "issuer",
    "subject",
    "event",
    "future",
    "lifetime",
  ])("rejects %s claims", async (test) => {
    const f = await fixture();
    const c = { ...f.claims };
    if (test === "expired") c.exp = now / 1000 - 1;
    if (test === "audience") c.aud = ["https://evil.example.test/"];
    if (test === "application") c.aid = 123;
    if (test === "issuer") c.iss = "https://evil.example.test";
    if (test === "subject") c.sub = "company:99999";
    if (test === "event") c.jti = "other";
    if (test === "future") c.iat = now / 1000 + 120;
    if (test === "lifetime") c.exp = now / 1000 + 999999;
    await expect(
      verifyFicNotification(await f.request(f.event, c), f.options),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
  it("rejects tampered JWTs, alternate algorithms, wrong keys and unsigned callbacks", async () => {
    const f = await fixture();
    const token = await f.token();
    const parts = token.split(".");
    parts[1] = base64(
      new TextEncoder().encode(
        JSON.stringify({ ...f.claims, sub: "company:99999" }),
      ),
    );
    for (const value of [
      parts.join("."),
      await f.token(f.claims, { alg: "HS256" }),
      "none",
    ])
      await expect(
        verifyFicJwt(
          new Request(f.options.audience, {
            headers: { Authorization: `Bearer ${value}` },
          }),
          f.options,
        ),
      ).rejects.toMatchObject({ code: "unauthorized" });
    await expect(
      verifyFicNotification(await f.request(), {
        ...f.options,
        publicKey: FIC_WEBHOOK_PUBLIC_KEY,
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
  it("rejects malformed, unsupported or oversized events before any upstream read", async () => {
    const f = await fixture();
    for (const body of [
      { ...f.event, data: { ids: [] } },
      { ...f.event, type: "unrelated" },
      { ...f.event, data: { ids: [-1] } },
      { ...f.event, data: { ids: [500] }, padding: "x".repeat(16384) },
    ])
      await expect(
        verifyFicNotification(await f.request(body), f.options),
      ).rejects.toMatchObject({ code: "invalid_input" });
  });
});

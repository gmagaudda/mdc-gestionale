import { beforeAll, describe, expect, it, vi } from "vitest";
import { deliverPush } from "./push-delivery";
import { pushSubscriptionSchema, isPushEndpoint } from "./push-schema";
const encode = (bytes: ArrayBuffer | Uint8Array) =>
  Buffer.from(new Uint8Array(bytes)).toString("base64url");
let subscription: {
  endpoint: string;
  expirationTime: null;
  keys: { p256dh: string; auth: string };
};
let vapid: { publicKey: string; privateKey: string; subject: string };
beforeAll(async () => {
  const recipient = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const signer = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/synthetic-only",
    expirationTime: null,
    keys: {
      p256dh: encode(await crypto.subtle.exportKey("raw", recipient.publicKey)),
      auth: encode(crypto.getRandomValues(new Uint8Array(16))),
    },
  };
  vapid = {
    publicKey: encode(await crypto.subtle.exportKey("raw", signer.publicKey)),
    privateKey: (await crypto.subtle.exportKey("jwk", signer.privateKey)).d!,
    subject: "https://example.test",
  };
});
describe("Web Push boundaries and encrypted HTTP delivery", () => {
  it.each([
    "http://fcm.googleapis.com/send/a",
    "https://localhost/a",
    "https://127.0.0.1/a",
    "https://fcm.googleapis.com.evil.test/a",
    "https://fcm.googleapis.com:8443/a",
    "https://user@fcm.googleapis.com/a",
    "https://web.push.apple.com/a#fragment",
    "file:///tmp/a",
  ])("rejects arbitrary endpoints: %s", (value) =>
    expect(isPushEndpoint(value)).toBe(false),
  );
  it.each([
    "https://fcm.googleapis.com/fcm/send/a",
    "https://updates.push.services.mozilla.com/wpush/v2/a",
    "https://web.push.apple.com/a",
    "https://wns2-am3p.notify.windows.com/w/?token=a",
  ])("accepts browser services: %s", (value) =>
    expect(isPushEndpoint(value)).toBe(true),
  );
  it("rejects malformed keys without throwing", () => {
    expect(() =>
      pushSubscriptionSchema.safeParse({
        ...subscription,
        keys: { p256dh: "_", auth: "_" },
      }),
    ).not.toThrow();
    expect(
      pushSubscriptionSchema.safeParse({
        ...subscription,
        keys: { p256dh: "_", auth: "_" },
      }).success,
    ).toBe(false);
  });
  it("encrypts a generic reminder and bounds the request", async () => {
    const transport = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 201 }),
    );
    expect(
      await deliverPush(
        subscription,
        "00000000-0000-4000-8000-000000000001",
        vapid,
        transport,
      ),
    ).toEqual({ status: "sent", expired: false });
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe(subscription.endpoint);
    expect(init).toMatchObject({ method: "post", redirect: "error" });
    expect(init!.signal).toBeInstanceOf(AbortSignal);
    const headers = new Headers(init!.headers);
    expect(headers.get("content-encoding")).toBe("aes128gcm");
    expect(headers.get("ttl")).toBe("3600");
    expect(headers.get("authorization")).toMatch(/^vapid t=/);
    const body = new Uint8Array(init!.body as ArrayBuffer);
    expect(body.length).toBe(4096);
    expect(Buffer.from(body).includes(Buffer.from("MDC Gestionale"))).toBe(
      false,
    );
    expect(Buffer.from(body).includes(Buffer.from("/calendar"))).toBe(false);
  });
  it.each([404, 410])(
    "discards expired HTTP %s subscriptions",
    async (status) => {
      const transport = vi.fn<typeof fetch>(
        async () => new Response(null, { status }),
      );
      expect(
        await deliverPush(subscription, crypto.randomUUID(), vapid, transport),
      ).toEqual({ status: "discarded", expired: true });
    },
  );
  it.each([429, 500, 503])(
    "records HTTP %s for bounded DB retries, without looping HTTP",
    async (status) => {
      const transport = vi.fn<typeof fetch>(
        async () => new Response(null, { status }),
      );
      expect(
        await deliverPush(subscription, crypto.randomUUID(), vapid, transport),
      ).toEqual({ status: "failed", expired: false });
      expect(transport).toHaveBeenCalledTimes(1);
    },
  );
  it("records uncertain transport failures without reporting delivery", async () => {
    const transport = vi.fn<typeof fetch>(async () => {
      throw Error("transport");
    });
    expect(
      await deliverPush(subscription, crypto.randomUUID(), vapid, transport),
    ).toEqual({ status: "failed", expired: false });
  });
  it("never fetches an arbitrary subscription", async () => {
    const transport = vi.fn<typeof fetch>();
    expect(
      await deliverPush(
        { ...subscription, endpoint: "https://localhost/private" },
        crypto.randomUUID(),
        vapid,
        transport,
      ),
    ).toEqual({ status: "discarded", expired: true });
    expect(transport).not.toHaveBeenCalled();
  });
});

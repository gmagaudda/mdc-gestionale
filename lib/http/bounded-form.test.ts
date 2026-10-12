import { it, expect } from "vitest";
import { boundedForm, RequestTooLarge } from "./bounded-form";
it("parses an allowed multipart body", async () => {
  const body = new FormData();
  body.set("metadata", "{}");
  body.set(
    "file",
    new File(["%PDF-1.4"], "test.pdf", { type: "application/pdf" }),
  );
  const parsed = await boundedForm(
    new Request("https://app.test", { method: "POST", body }),
    2048,
  );
  expect(parsed.get("metadata")).toBe("{}");
  expect((parsed.get("file") as File).name).toBe("test.pdf");
});
it("rejects oversize Content-Length before reading", async () => {
  await expect(
    boundedForm(
      new Request("https://app.test", {
        method: "POST",
        body: "x",
        headers: { "Content-Length": "100" },
      }),
      10,
    ),
  ).rejects.toBeInstanceOf(RequestTooLarge);
});
it("bounds and cancels streaming bodies without Content-Length", async () => {
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(16));
    },
    cancel() {
      canceled = true;
    },
  });
  const options: RequestInit & { duplex: "half" } = {
    method: "POST",
    body,
    duplex: "half",
  };
  await expect(
    boundedForm(new Request("https://app.test", options), 10),
  ).rejects.toBeInstanceOf(RequestTooLarge);
  expect(canceled).toBe(true);
});

import { InvoicingError } from "../types";
export const FIC_ORIGIN = "https://api-v2.fattureincloud.it";
export type FicTransport = typeof fetch;
export class FicHttpError extends InvoicingError {
  constructor(public readonly status: number) {
    super(
      status === 401 || status === 403
        ? "unauthorized"
        : status === 404
          ? "not_found"
          : status === 409
            ? "conflict"
            : status === 400 || status === 422
              ? "invalid_input"
              : "unavailable",
      status === 429 || status >= 500,
    );
  }
}
export async function readJson(
  response: Response,
  maxBytes = 4 * 1024 * 1024,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new InvoicingError("unavailable", true);
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new InvoicingError("unavailable");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InvoicingError("unavailable");
  }
}
export class FicHttpClient {
  constructor(
    private readonly accessToken: string,
    private readonly transport: FicTransport = fetch,
    private readonly pause = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ) {
    if (!accessToken || accessToken.length > 8192 || /[\r\n]/.test(accessToken))
      throw new InvoicingError("unavailable");
  }
  async request(
    path: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    body?: unknown,
    readOnlyPost = false,
  ): Promise<unknown> {
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new InvoicingError("invalid_input");
    // Retry only reads and totals calculations. Creation/deletion is never blindly repeated.
    const safe = method === "GET" || readOnlyPost;
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.transport(`${FIC_ORIGIN}${path}`, {
          method,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.accessToken}`,
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        if (safe && attempt < 2) {
          await this.pause(250 * 2 ** attempt);
          continue;
        }
        throw new InvoicingError("unavailable", true);
      }
      if (!response.ok) {
        const status = response.status;
        const retryAfter = response.headers.get("retry-after");
        await response.body?.cancel();
        if (safe && attempt < 2 && (status === 429 || status >= 500)) {
          const seconds =
            retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
          if (seconds > 2) throw new FicHttpError(status);
          await this.pause(Math.max(seconds * 1000, 250 * 2 ** attempt));
          continue;
        }
        throw new FicHttpError(status);
      }
      if (response.status === 204 || method === "DELETE") {
        await response.body?.cancel();
        return null;
      }
      return readJson(response);
    }
  }
}

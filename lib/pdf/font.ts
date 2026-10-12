import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
export async function pdfFont() {
  let assets: { fetch(input: string): Promise<Response> } | undefined;
  try {
    assets = getCloudflareContext().env.ASSETS;
  } catch {
    /* Next development has no Worker bindings. */
  }
  const url = assets
    ? "https://assets.invalid/fonts/Inter-Regular.ttf"
    : new URL("/fonts/Inter-Regular.ttf", process.env.APP_URL).toString();
  const response = assets
    ? await assets.fetch(url)
    : await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw Error("PDF font unavailable");
  return new Uint8Array(await response.arrayBuffer());
}

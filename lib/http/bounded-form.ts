export class RequestTooLarge extends Error {}
export async function boundedForm(request: Request, limit: number) {
  const length = request.headers.get("Content-Length");
  if (length && Number(length) > limit) throw new RequestTooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > limit) throw new RequestTooLarge();
      chunks.push(item.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new Response(bytes, {
    headers: { "Content-Type": request.headers.get("Content-Type") ?? "" },
  }).formData();
}

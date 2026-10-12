import { Temporal } from "temporal-polyfill";
import { showroomTimeZone } from "@/lib/dates/rome";
export function tomorrowInRome(now: Date) {
  const tomorrow = Temporal.Instant.from(now.toISOString())
    .toZonedDateTimeISO(showroomTimeZone)
    .toPlainDate()
    .add({ days: 1 });
  return {
    start: tomorrow.toZonedDateTime(showroomTimeZone).toInstant().toString(),
    end: tomorrow
      .add({ days: 1 })
      .toZonedDateTime(showroomTimeZone)
      .toInstant()
      .toString(),
  };
}
export async function cronAuthorized(
  request: Request,
  secret: string | undefined,
) {
  if (!secret || secret.length < 32) return false;
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  const received = new TextEncoder().encode(
    request.headers.get("Authorization") ?? "",
  );
  // Hash both sides first so comparison does not reveal the matching prefix.
  const hashes = await Promise.all(
    [expected, received].map((value) => crypto.subtle.digest("SHA-256", value)),
  );
  const a = new Uint8Array(hashes[0]),
    b = new Uint8Array(hashes[1]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

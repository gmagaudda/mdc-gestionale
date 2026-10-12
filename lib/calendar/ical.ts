import { z } from "zod";
import { utcToRome } from "@/lib/dates/rome";
export const feedEventSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  location: z.string(),
  starts_at: z.iso.datetime({ offset: true }),
  ends_at: z.iso.datetime({ offset: true }),
  all_day: z.boolean(),
  updated_at: z.iso.datetime({ offset: true }),
});
export type FeedEvent = z.infer<typeof feedEventSchema>;
const escape = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const stamp = (utc: string) =>
  new Date(utc).toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z";
// RFC 5545: 75 octets per physical line, without splitting UTF-8 code points.
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = "",
    octets = 0;
  for (const point of line) {
    const size = encoder.encode(point).length;
    if (octets + size > 75) {
      result += "\r\n ";
      octets = 1;
    }
    result += point;
    octets += size;
  }
  return result;
}
export function calendarFeed(events: FeedEvent[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MDC//Calendario//IT",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Calendario MDC",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@mdc`,
      `DTSTAMP:${stamp(event.updated_at)}`,
      `LAST-MODIFIED:${stamp(event.updated_at)}`,
      ...(event.all_day
        ? [
            `DTSTART;VALUE=DATE:${utcToRome(event.starts_at).slice(0, 10).replace(/-/g, "")}`,
            `DTEND;VALUE=DATE:${utcToRome(event.ends_at).slice(0, 10).replace(/-/g, "")}`,
          ]
        : [
            `DTSTART:${stamp(event.starts_at)}`,
            `DTEND:${stamp(event.ends_at)}`,
          ]),
      `SUMMARY:${escape(event.title)}`,
      `DESCRIPTION:${escape(event.description)}`,
      `LOCATION:${escape(event.location)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

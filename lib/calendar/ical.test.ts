import { describe, it, expect } from "vitest";
import ICAL from "ical.js";
import { calendarFeed, type FeedEvent } from "./ical";
import { newIcalToken, hashToken, icalTokenPattern } from "./token";
const event: FeedEvent = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Appuntamento; è, nuovo\\campionario\n" + "🧵".repeat(60),
  description: "Riga 1\r\nRiga 2",
  location: "Milano, showroom",
  starts_at: "2026-10-12T07:00:00+00:00",
  ends_at: "2026-10-12T08:00:00+00:00",
  updated_at: "2026-10-10T12:00:00Z",
  all_day: false,
};
describe("iCalendar interoperability", () => {
  it("parses escaped text, UTF-8 folding and UTC dates without loss", () => {
    const text = calendarFeed([event]);
    const parsed = new ICAL.Component(ICAL.parse(text));
    const entry = new ICAL.Event(parsed.getFirstSubcomponent("vevent")!);
    expect(entry.summary).toBe(event.title);
    expect(entry.description).toBe("Riga 1\nRiga 2");
    expect(entry.location).toBe(event.location);
    expect(entry.startDate.toJSDate().toISOString()).toBe(
      "2026-10-12T07:00:00.000Z",
    );
    for (const line of text.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(text).not.toContain("�");
  });
  it("preserves exclusive Rome all-day dates across the DST change", () => {
    const text = calendarFeed([
      {
        ...event,
        all_day: true,
        starts_at: "2026-10-24T22:00:00Z",
        ends_at: "2026-10-25T23:00:00Z",
      },
    ]);
    const entry = new ICAL.Event(
      new ICAL.Component(ICAL.parse(text)).getFirstSubcomponent("vevent")!,
    );
    expect(entry.startDate.isDate).toBe(true);
    expect(entry.startDate.toString()).toBe("2026-10-25");
    expect(entry.endDate.toString()).toBe("2026-10-26");
  });
  it("generates independent bearer secrets and stores only a stable digest", async () => {
    const a = newIcalToken(),
      b = newIcalToken();
    expect(a).not.toBe(b);
    expect(icalTokenPattern.test(a)).toBe(true);
    expect(await hashToken(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(await hashToken(a)).toBe(await hashToken(a));
    expect(await hashToken(a)).not.toContain(a);
  });
});

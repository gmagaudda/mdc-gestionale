import { it, expect } from "vitest";
import { tomorrowInRome, cronAuthorized } from "./reminders";
it("uses tomorrow in Rome even when UTC is still the previous day", () => {
  expect(tomorrowInRome(new Date("2026-10-12T22:30:00Z"))).toEqual({
    start: "2026-10-13T22:00:00Z",
    end: "2026-10-14T22:00:00Z",
  });
});
it("covers 23 and 25 hour days at the DST boundaries", () => {
  for (const [now, hours] of [
    ["2026-03-28T06:00:00Z", 23],
    ["2026-10-24T06:00:00Z", 25],
  ] as const) {
    const range = tomorrowInRome(new Date(now));
    expect((Date.parse(range.end) - Date.parse(range.start)) / 3600000).toBe(
      hours,
    );
  }
});
it("requires the configured cron bearer secret and refuses missing configuration", async () => {
  const secret = "x".repeat(48),
    request = new Request("https://app.test/api/cron/reminders", {
      headers: { Authorization: `Bearer ${secret}` },
    });
  expect(await cronAuthorized(request, secret)).toBe(true);
  expect(await cronAuthorized(request, undefined)).toBe(false);
  expect(await cronAuthorized(request, "y".repeat(48))).toBe(false);
  expect(await cronAuthorized(new Request(request.url), secret)).toBe(false);
});

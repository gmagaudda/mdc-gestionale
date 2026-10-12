import { expect, it } from "vitest";
import { romeToUtc, utcToRome, addLocalDays } from "./rome";
it("converts showroom time independently of the browser zone and rejects DST gaps or folds", () => {
  expect(romeToUtc("2026-10-12T09:00")).toBe("2026-10-12T07:00:00Z");
  expect(romeToUtc("2026-01-12T09:00")).toBe("2026-01-12T08:00:00Z");
  expect(utcToRome("2026-10-12T07:00:00Z")).toBe("2026-10-12T09:00");
  expect(() => romeToUtc("2026-03-29T02:30")).toThrow();
  expect(() => romeToUtc("2026-10-25T02:30")).toThrow();
  expect(addLocalDays("2026-03-28T00:00", 2)).toBe("2026-03-30T00:00");
});

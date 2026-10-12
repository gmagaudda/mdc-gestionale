import { Temporal } from "temporal-polyfill";
export const showroomTimeZone = "Europe/Rome";
export function romeToUtc(local: string) {
  return Temporal.PlainDateTime.from(local)
    .toZonedDateTime(showroomTimeZone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}
export function utcToRome(utc: string) {
  return Temporal.Instant.from(utc)
    .toZonedDateTimeISO(showroomTimeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function addLocalDays(local: string, days: number) {
  return Temporal.PlainDateTime.from(local)
    .add({ days })
    .toString({ smallestUnit: "minute" });
}

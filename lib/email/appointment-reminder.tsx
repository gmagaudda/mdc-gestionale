import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  render,
  toPlainText,
} from "react-email";
import messages from "@/messages/it.json";
import { Temporal } from "temporal-polyfill";
import { utcToRome, showroomTimeZone } from "@/lib/dates/rome";
export type AppointmentReminder = {
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
};
export async function renderAppointmentReminder(event: AppointmentReminder) {
  const copy = messages.reminders;
  const dateFormat = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "full",
  });
  const start = new Date(event.starts_at);
  const end = new Date(
    event.all_day
      ? Temporal.Instant.from(event.ends_at)
          .toZonedDateTimeISO(showroomTimeZone)
          .toPlainDate()
          .subtract({ days: 1 })
          .toZonedDateTime(showroomTimeZone)
          .toInstant()
          .toString()
      : event.ends_at,
  );
  const date = event.all_day
    ? dateFormat.formatRange(start, end)
    : dateFormat.format(start);
  const time = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    timeStyle: "short",
  });
  const when = event.all_day
    ? copy.allDay
    : `${time.format(start)} - ${utcToRome(event.starts_at).slice(0, 10) !== utcToRome(event.ends_at).slice(0, 10) ? dateFormat.format(end) + ", " : ""}${time.format(end)}`;
  const html = await render(
    <Html lang="it">
      <Head />
      <Body>
        <Container>
          <Heading as="h1">{copy.heading}</Heading>
          <Text>{event.title}</Text>
          <Text>
            {date}. {when}. {copy.timeZone}
          </Text>
          {event.location && (
            <Text>
              {copy.location}: {event.location}
            </Text>
          )}
          {event.description && (
            <Text style={{ whiteSpace: "pre-wrap" }}>{event.description}</Text>
          )}
          <Text>{copy.footer}</Text>
        </Container>
      </Body>
    </Html>,
  );
  return { subject: copy.subject, html, text: toPlainText(html) };
}

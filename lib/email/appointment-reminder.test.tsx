import { it, expect } from "vitest";
import { renderAppointmentReminder } from "./appointment-reminder";
it("renders Italian HTML and plain text with escaped user input and Rome time", async () => {
  const message = await renderAppointmentReminder({
    title: "Campionario <script> & lana",
    description: "Prima riga\nSeconda riga",
    location: "Showroom",
    starts_at: "2026-10-12T07:00:00Z",
    ends_at: "2026-10-12T08:00:00Z",
    all_day: false,
  });
  expect(message.html).toContain('lang="it"');
  expect(message.html).not.toContain("<script>");
  expect(message.html).toContain("&lt;script&gt;");
  expect(message.text).toContain("09:00 - 10:00");
  expect(message.text).toContain("Seconda riga");
});

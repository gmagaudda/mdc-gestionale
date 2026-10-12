import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { calendarChoices } from "@/modules/calendar/queries";
import { CalendarBoard } from "@/modules/calendar/components/calendar-board";
export default async function CalendarPage() {
  const user = await requireRole(internalRoles);
  const t = await getTranslations("calendar");
  const choices = await calendarChoices();
  const initialDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <>
      <PageHeader title={t("calendar")} />
      <CalendarBoard
        choices={choices}
        editable={user.role !== "accounting"}
        initialDate={initialDate}
        userId={user.id}
      />
    </>
  );
}

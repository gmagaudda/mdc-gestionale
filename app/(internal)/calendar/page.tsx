import { requireRole } from "@/lib/auth";
import { internalRoles } from "@/lib/auth/roles";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { calendarChoices } from "@/modules/calendar/queries";
import { CalendarBoard } from "@/modules/calendar/components/calendar-board";
import { CalendarFeedSettings } from "@/modules/calendar/components/calendar-feed-settings";
import { createClient } from "@/lib/supabase/server";
export default async function CalendarPage() {
  const user = await requireRole(internalRoles);
  const t = await getTranslations("calendar");
  const choices = await calendarChoices();
  const feed = await (
    await createClient()
  )
    .from("ical_tokens")
    .select("revoked_at")
    .eq("user_id", user.id)
    .maybeSingle();
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
      <CalendarFeedSettings
        active={!!feed.data && feed.data.revoked_at === null}
        loadError={!!feed.error}
      />
    </>
  );
}

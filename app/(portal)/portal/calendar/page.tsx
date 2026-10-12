import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { getPortalContext } from "@/modules/portal/context";
import { createClient } from "@/lib/supabase/server";
import { CalendarBoard } from "@/modules/calendar/components/calendar-board";
import { CalendarFeedSettings } from "@/modules/calendar/components/calendar-feed-settings";
export default async function Calendar() {
  const user = await requireRole(["brand"]),
    c = await getPortalContext({}),
    t = await getTranslations("calendar"),
    p = await getTranslations("portal"),
    feed = await (
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
      <h1>{t("calendar")}</h1>
      <p>{p("calendarHint")}</p>
      <CalendarBoard
        choices={{ brands: c.brands, customers: [], assignees: [] }}
        editable={false}
        portal
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

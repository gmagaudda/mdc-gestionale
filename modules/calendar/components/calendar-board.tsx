"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import FullCalendar, {
  type CalendarRef,
  type EventSourceFunc,
  type EventDropInfo,
  type EventResizeDoneInfo,
} from "@fullcalendar/react";
import daygrid from "@fullcalendar/react/daygrid";
import timegrid from "@fullcalendar/react/timegrid";
import list from "@fullcalendar/react/list";
import interaction from "@fullcalendar/react/interaction";
import theme from "@fullcalendar/react/themes/classic";
import it from "@fullcalendar/react/locales/it";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "motion/react";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { SelectField } from "@/components/shared/select-field";
import { SearchSelect } from "@/components/shared/search-select";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { EventForm, type CalendarChoices } from "./event-form";
import { utcToRome } from "@/lib/dates/rome";
import { eventTypes, type EventInput } from "../schema";
import { moveEvent } from "../actions";
import { searchOrderCustomers } from "@/modules/orders/actions";
import type { CalendarEvent } from "../queries";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
const media = "(min-width: 1024px) and (pointer: fine)";
const subscribe = (cb: () => void) => {
  const query = window.matchMedia(media);
  query.addEventListener("change", cb);
  return () => query.removeEventListener("change", cb);
};
const snapshot = () => window.matchMedia(media).matches;
const serverSnapshot = () => false;
const plugins = [theme, daygrid, timegrid, list, interaction];
const locale = { ...it };
export function CalendarBoard({
  choices,
  editable: allowEdit,
  initialDate,
  userId,
  portal = false,
}: {
  choices: CalendarChoices;
  editable: boolean;
  initialDate: string;
  userId: string;
  portal?: boolean;
}) {
  const editable = allowEdit && !portal;
  const t = useTranslations("calendar");
  const reduced = useReducedMotion();
  const desktop = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const committed = useRef(false),
    deferred = useRef<(() => void)[]>([]);
  const notify = useCallback((update: () => void) => {
    if (!committed.current) {
      deferred.current.push(update);
      return;
    }
    queueMicrotask(() => {
      if (committed.current) update();
    });
  }, []);
  useEffect(() => {
    committed.current = true;
    deferred.current.splice(0).forEach((update) => update());
    return () => {
      committed.current = false;
    };
  }, []);
  const calendar = useRef<CalendarRef>(null),
    returnFocus = useRef<HTMLElement | null>(null),
    ticket = useRef(0);
  const [view, setView] = useState("listWeek"),
    [title, setTitle] = useState("");
  const [filters, setFilters] = useState({
    brand_id: "",
    customer_id: "",
    assigned_to: "",
    type: "",
  });
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<CalendarEvent | undefined>(),
    [formKey, setFormKey] = useState(0);
  const [pending, start] = useTransition();
  useEffect(() => {
    calendar.current
      ?.getApi()
      .changeView(desktop ? "dayGridMonth" : "listWeek");
  }, [desktop]);
  const events = useCallback<EventSourceFunc>(
    async (info, resolve, reject) => {
      const request = ++ticket.current;
      notify(() => {
        setLoading(true);
        setError("");
      });
      try {
        const params = new URLSearchParams({
          start: info.startStr,
          end: info.endStr,
          ...(portal
            ? { brand_id: filters.brand_id, type: filters.type }
            : filters),
        });
        const response = await fetch(
          `${portal ? "/api/portal/calendar" : "/api/calendar"}?${params}`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok) {
          if (request === ticket.current)
            notify(() =>
              setError(response.status === 413 ? "tooMany" : "loadError"),
            );
          reject(Error("Calendar unavailable"));
          return;
        }
        const received: CalendarEvent[] = await response.json();
        const rows = portal
          ? received.map((row) => ({
              ...row,
              customer_id: null,
              assigned_to: null,
              created_at: "",
              updated_at: "",
              deleted_at: null,
              visible_to_brand: true,
            }))
          : received;
        resolve(
          rows.map((row) => ({
            id: row.id,
            title: row.title,
            start: row.starts_at,
            end: row.ends_at,
            allDay: row.all_day,
            extendedProps: { row },
          })),
        );
      } catch {
        if (request === ticket.current) notify(() => setError("loadError"));
        reject(Error("Calendar unavailable"));
      } finally {
        if (request === ticket.current) notify(() => setLoading(false));
      }
    },
    [filters, notify, portal],
  );
  const changed = (info: EventDropInfo | EventResizeDoneInfo) => {
    const row = info.event.extendedProps.row as CalendarEvent;
    if (!info.event.start || !info.event.end) {
      info.revert();
      return;
    }
    setError("");
    setSuccess(false);
    start(async () => {
      try {
        const result = await moveEvent({
          id: row.id,
          starts_at: info.event.start!.toISOString(),
          ends_at: info.event.end!.toISOString(),
          all_day: info.event.allDay,
          updated_at: row.updated_at,
        });
        if (!result.ok) {
          info.revert();
          setError(result.error);
        } else {
          setSuccess(true);
          calendar.current?.getApi().refetchEvents();
        }
      } catch {
        info.revert();
        setError("saveError");
      }
    });
  };
  const blank: EventInput = {
    title: "",
    type: "appointment",
    description: "",
    starts_at: `${initialDate}T09:00`,
    ends_at: `${initialDate}T10:00`,
    all_day: false,
    brand_id: filters.brand_id,
    customer_id: filters.customer_id,
    assigned_to: userId,
    visible_to_brand: false,
    location: "",
  };
  const initial: EventInput = selected
    ? {
        ...selected,
        starts_at: utcToRome(selected.starts_at),
        ends_at: utcToRome(selected.ends_at),
        brand_id: selected.brand_id ?? "",
        customer_id: selected.customer_id ?? "",
        assigned_to: selected.assigned_to ?? "",
      }
    : blank;
  return (
    <div className="stack">
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        busy={busy}
        title={selected ? selected.title : t("newEvent")}
        trigger={
          editable ? (
            <Button
              size="lg"
              onClick={() => {
                setSelected(undefined);
                setFormKey((k) => k + 1);
                returnFocus.current = document.activeElement as HTMLElement;
              }}
            >
              {t("newEvent")}
            </Button>
          ) : undefined
        }
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (returnFocus.current?.isConnected) returnFocus.current.focus();
          else document.getElementById("calendar-view")?.focus();
        }}
      >
        <EventForm
          key={formKey}
          event={selected}
          initial={initial}
          editable={editable}
          portal={portal}
          choices={choices}
          onBusy={setBusy}
          onSaved={() => {
            setOpen(false);
            setSuccess(true);
            calendar.current?.getApi().refetchEvents();
          }}
        />
      </ResponsiveDialog>
      <details>
        <summary>{t("filters")}</summary>
        <div className="form-grid">
          <SearchSelect
            label={t("brand")}
            value={filters.brand_id || "all"}
            options={[
              { value: "all", label: t("allBrands") },
              ...choices.brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, brand_id: v === "all" ? "" : v }))
            }
          />
          {!portal && (
            <SearchSelect
              label={t("customer_id")}
              value={filters.customer_id || "all"}
              options={[
                { value: "all", label: t("allCustomers") },
                ...choices.customers.map((c) => ({
                  value: c.id,
                  label: c.legal_name,
                })),
              ]}
              loadOptions={async (term) => {
                const result = await searchOrderCustomers(term);
                return result.ok
                  ? {
                      ok: true as const,
                      data: [
                        { value: "all", label: t("allCustomers") },
                        ...result.data,
                      ],
                    }
                  : result;
              }}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, customer_id: v === "all" ? "" : v }))
              }
            />
          )}
          {!portal && (
            <SelectField
              label={t("assigned_to")}
              value={filters.assigned_to || "all"}
              options={[
                { value: "all", label: t("allAssignees") },
                ...choices.assignees.map((a) => ({
                  value: a.id,
                  label: a.full_name || a.email,
                })),
              ]}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, assigned_to: v === "all" ? "" : v }))
              }
            />
          )}
          <SelectField
            label={t("type")}
            value={filters.type || "all"}
            options={[
              { value: "all", label: t("allTypes") },
              ...eventTypes.map((type) => ({
                value: type,
                label: t(`types.${type}`),
              })),
            ]}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, type: v === "all" ? "" : v }))
            }
          />
        </div>
      </details>
      <div className="form-actions report-actions">
        <Button
          size="lg"
          variant="secondary"
          onClick={() => calendar.current?.getApi().prev()}
        >
          {t("previous")}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => calendar.current?.getApi().today()}
        >
          {t("today")}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => calendar.current?.getApi().next()}
        >
          {t("next")}
        </Button>
      </div>
      <SelectField
        id="calendar-view"
        label={t("view")}
        value={view}
        options={[
          { value: "listWeek", label: t("list") },
          { value: "dayGridMonth", label: t("month") },
          { value: "timeGridWeek", label: t("week") },
          { value: "timeGridDay", label: t("day") },
        ]}
        onValueChange={(v) => calendar.current?.getApi().changeView(v)}
      />
      <h2>{title || t("calendar")}</h2>
      <p>
        {t("timeZone")}
        {editable && desktop ? ` ${t("dragHint")}` : ""}
      </p>
      <Alert open={success} tone="success" title={t("saved")} />
      <Alert
        open={Boolean(error)}
        tone="danger"
        title={error ? t(error) : ""}
      />
      {error && (
        <Button
          variant="secondary"
          size="lg"
          onClick={() => calendar.current?.getApi().refetchEvents()}
        >
          {t("retry")}
        </Button>
      )}
      {loading && (
        <div aria-label={t("loading")}>
          <Skeleton label={t("loading")} lines={1} />
        </div>
      )}
      <div className="calendar-surface" aria-busy={loading || pending}>
        <FullCalendar
          ref={calendar}
          plugins={plugins}
          locale={locale}
          timeZone="Europe/Rome"
          initialDate={initialDate}
          initialView="listWeek"
          headerToolbar={false}
          height="auto"
          events={events}
          eventInteractive
          editable={editable && desktop && !pending && !busy}
          eventResizableFromStart={editable && desktop && !pending && !busy}
          dragRevertDuration={reduced ? 0 : motionTokens.duration.fast * 1000}
          dayMaxEvents={false}
          datesSet={(info) => {
            // FullCalendar may notify during its React render.
            notify(() => {
              setTitle(info.view.title);
              setView(info.view.type);
            });
          }}
          eventDidMount={(info) => {
            info.el.setAttribute("data-event-id", info.event.id);
            // FullCalendar 7 places interactive event buttons directly in a list.
            // Group semantics retain the actions without invalid list children.
            const group = info.el.closest('[role="list"]');
            group?.setAttribute("role", "group");
            group?.setAttribute("aria-label", t("events"));
            group?.querySelectorAll('[role="listitem"]').forEach((item) => {
              if (!item.closest('[role="list"]'))
                item.setAttribute("role", "group");
            });
          }}
          eventClick={(info) => {
            returnFocus.current = info.el;
            setSelected(info.event.extendedProps.row as CalendarEvent);
            setFormKey((k) => k + 1);
            setOpen(true);
          }}
          eventDrop={changed}
          eventResize={changed}
          noEventsContent={() => t(portal ? "emptyPortal" : "empty")}
          eventColor="var(--accent)"
          eventContrastColor="var(--background)"
        />
      </div>
    </div>
  );
}

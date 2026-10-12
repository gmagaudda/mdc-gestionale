"use client";
import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { Alert } from "@/components/arc/alert/alert";
import { SearchSelect, type Choice } from "@/components/shared/search-select";
import { SelectField } from "@/components/shared/select-field";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { utcToRome, addLocalDays } from "@/lib/dates/rome";
import { eventSchema, eventTypes, type EventInput } from "../schema";
import { saveEvent, archiveEvent } from "../actions";
import { searchOrderCustomers } from "@/modules/orders/actions";
import type { CalendarEvent } from "../queries";
const shiftDay = (value: string, days: number) => {
  try {
    return addLocalDays(value, days);
  } catch {
    return "";
  }
};
export type CalendarChoices = {
  brands: { id: string; name: string }[];
  customers: { id: string; legal_name: string; city: string }[];
  assignees: { id: string; full_name: string; email: string }[];
};
export function EventForm({
  event,
  initial,
  choices,
  onSaved,
  onBusy,
  editable,
}: {
  event?: CalendarEvent;
  initial: EventInput;
  choices: CalendarChoices;
  onSaved: () => void;
  onBusy: (busy: boolean) => void;
  editable: boolean;
}) {
  const t = useTranslations("calendar");
  const form = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const update = <K extends keyof EventInput>(key: K, next: EventInput[K]) =>
    setValue((v) => ({ ...v, [key]: next }));
  const optional = (options: Choice[]) => [
    { value: "none", label: t("none") },
    ...options,
  ];
  const customerOptions = choices.customers.map((c) => ({
    value: c.id,
    label: [c.legal_name, c.city].filter(Boolean).join(" · "),
  }));
  if (
    event?.customer_id &&
    event.customer_name &&
    !customerOptions.some((c) => c.value === event.customer_id)
  )
    customerOptions.push({
      value: event.customer_id,
      label: event.customer_name,
    });
  const brandOptions = choices.brands.map((b) => ({
    value: b.id,
    label: b.name,
  }));
  if (
    event?.brand_id &&
    event.brand_name &&
    !brandOptions.some((b) => b.value === event.brand_id)
  )
    brandOptions.push({ value: event.brand_id, label: event.brand_name });
  if (!editable)
    return (
      <dl className="details-grid">
        <div>
          <dt>{t("type")}</dt>
          <dd>{t(`types.${initial.type}`)}</dd>
        </div>
        <div>
          <dt>{t("starts_at")}</dt>
          <dd>{utcToRome(event!.starts_at).replace("T", " ")}</dd>
        </div>
        <div>
          <dt>{t("ends_at")}</dt>
          <dd>{utcToRome(event!.ends_at).replace("T", " ")}</dd>
        </div>
        <div>
          <dt>{t("brand")}</dt>
          <dd>
            {brandOptions.find((b) => b.value === initial.brand_id)?.label ||
              t("none")}
          </dd>
        </div>
        <div>
          <dt>{t("customer_id")}</dt>
          <dd>
            {customerOptions.find((c) => c.value === initial.customer_id)
              ?.label || t("none")}
          </dd>
        </div>
        <div>
          <dt>{t("assigned_to")}</dt>
          <dd>
            {choices.assignees.find((a) => a.id === initial.assigned_to)
              ?.full_name || t("none")}
          </dd>
        </div>
        <div>
          <dt>{t("description")}</dt>
          <dd className="preserve-text">{initial.description || t("none")}</dd>
        </div>
        <div>
          <dt>{t("location")}</dt>
          <dd>{initial.location || t("none")}</dd>
        </div>
      </dl>
    );
  return (
    <form
      ref={form}
      className="stack"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        setFields({});
        const parsed = eventSchema.safeParse(value);
        if (!parsed.success) {
          const issues: Record<string, string> = {};
          for (const issue of parsed.error.issues)
            issues[String(issue.path[0])] = t(
              [
                "dateRange",
                "timeInvalid",
                "allDayInvalid",
                "sharedNeedsBrand",
              ].includes(issue.message)
                ? issue.message
                : "validation",
            );
          setFields(issues);
          setError("validation");
          form.current
            ?.querySelector<HTMLElement>(
              `[id="event-${String(parsed.error.issues[0].path[0])}"]`,
            )
            ?.focus();
          return;
        }
        onBusy(true);
        start(async () => {
          try {
            const result = await saveEvent(
              event?.id ?? null,
              parsed.data,
              event?.updated_at,
            );
            if (result.ok) onSaved();
            else setError(result.error);
          } catch {
            setError("saveError");
          } finally {
            onBusy(false);
          }
        });
      }}
    >
      <fieldset className="stack" disabled={pending}>
        <Input
          id="event-title"
          label={t("title")}
          value={value.title}
          maxLength={200}
          required
          onChange={(e) => update("title", e.target.value)}
          error={fields.title}
        />
        <SelectField
          id="event-type"
          label={t("type")}
          value={value.type}
          onValueChange={(v) => update("type", v as EventInput["type"])}
          options={eventTypes.map((type) => ({
            value: type,
            label: t(`types.${type}`),
          }))}
          error={fields.type}
        />
        <Checkbox
          label={t("all_day")}
          checked={value.all_day}
          onCheckedChange={(checked) => {
            const all = checked === true;
            setValue((v) => ({
              ...v,
              all_day: all,
              starts_at: all
                ? v.starts_at.slice(0, 10) + "T00:00"
                : v.starts_at,
              ends_at: all
                ? shiftDay(v.ends_at.slice(0, 10) + "T00:00", 1)
                : v.ends_at,
            }));
          }}
          description={t("allDayHint")}
        />
        <div className="form-grid">
          <Input
            id="event-starts_at"
            label={t("starts_at")}
            type={value.all_day ? "date" : "datetime-local"}
            value={
              value.all_day ? value.starts_at.slice(0, 10) : value.starts_at
            }
            onChange={(e) =>
              update(
                "starts_at",
                value.all_day ? e.target.value + "T00:00" : e.target.value,
              )
            }
            required
            error={fields.starts_at}
          />
          <Input
            id="event-ends_at"
            label={value.all_day ? t("lastDay") : t("ends_at")}
            type={value.all_day ? "date" : "datetime-local"}
            value={
              value.all_day
                ? shiftDay(value.ends_at, -1).slice(0, 10)
                : value.ends_at
            }
            onChange={(e) => {
              try {
                update(
                  "ends_at",
                  value.all_day
                    ? shiftDay(e.target.value + "T00:00", 1)
                    : e.target.value,
                );
              } catch {
                update("ends_at", "");
              }
            }}
            required
            error={fields.ends_at}
          />
        </div>
        <p>{t("timeZone")}</p>
        <SearchSelect
          id="event-brand_id"
          label={t("brand")}
          value={value.brand_id || "none"}
          options={optional(brandOptions)}
          onValueChange={(v) => update("brand_id", v === "none" ? "" : v)}
          error={fields.brand_id}
        />
        <SearchSelect
          id="event-customer_id"
          label={t("customer_id")}
          value={value.customer_id || "none"}
          options={optional(customerOptions)}
          loadOptions={async (term) => {
            const result = await searchOrderCustomers(term);
            return result.ok
              ? { ok: true as const, data: optional(result.data) }
              : result;
          }}
          onValueChange={(v) => update("customer_id", v === "none" ? "" : v)}
          error={fields.customer_id}
        />
        <SelectField
          id="event-assigned_to"
          label={t("assigned_to")}
          value={value.assigned_to || "none"}
          options={optional(
            choices.assignees.map((a) => ({
              value: a.id,
              label: a.full_name || a.email,
            })),
          )}
          onValueChange={(v) => update("assigned_to", v === "none" ? "" : v)}
          error={fields.assigned_to}
        />
        <Input
          id="event-location"
          label={t("location")}
          value={value.location}
          maxLength={500}
          onChange={(e) => update("location", e.target.value)}
          error={fields.location}
        />
        <Textarea
          id="event-description"
          label={t("description")}
          value={value.description}
          maxLength={5000}
          onChange={(e) => update("description", e.target.value)}
          error={fields.description}
        />
        <Checkbox
          label={t("visible_to_brand")}
          checked={value.visible_to_brand}
          onCheckedChange={(checked) =>
            update("visible_to_brand", checked === true)
          }
          description={t("sharingHint")}
        />
      </fieldset>
      <Alert
        open={Boolean(error)}
        tone="danger"
        title={error ? t(error) : ""}
      />
      <Button type="submit" size="lg" disabled={pending} loading={pending}>
        {t("save")}
      </Button>
      {event && (
        <ConfirmAction
          label={t("archive")}
          question={t("archiveQuestion")}
          confirmLabel={t("archive")}
          action={async () => {
            const result = await archiveEvent(event.id);
            if (result.ok) onSaved();
            return result;
          }}
        />
      )}
    </form>
  );
}

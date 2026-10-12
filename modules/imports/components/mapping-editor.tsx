"use client";
import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { Textarea } from "@/components/arc/textarea/textarea";
import { Button } from "@/components/arc/button/button";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { Alert } from "@/components/arc/alert/alert";
import { NativeSelectField } from "@/components/shared/native-select-field";
import {
  canonicalFields,
  mappingProfileSchema,
  suggestMapping,
  type ImportEntity,
  type MappingProfile,
} from "../fields";
import { normalizeText } from "../normalize";
import type { ParsedSheet } from "../parser";
import { saveMappingProfile } from "../operational-actions";
export type SavedMappingProfile = MappingProfile & { id: string };
export type SheetMapping = {
  enabled: boolean;
  profile: MappingProfile;
  profileId: string | null;
};
export function MappingEditor({
  sheet,
  selection,
  onChange,
  allowedEntities,
  profiles,
}: {
  sheet: ParsedSheet;
  selection: SheetMapping;
  onChange: (selection: SheetMapping) => void;
  allowedEntities: readonly ImportEntity[];
  profiles: SavedMappingProfile[];
}) {
  const t = useTranslations("imports"),
    [pending, start] = useTransition(),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const profile = selection.profile,
    header = sheet.rows.find((r) => r.number === profile.header_row),
    available = profiles.filter((p) => allowedEntities.includes(p.entity));
  const nameRef = useRef<HTMLInputElement>(null);
  const update = (next: MappingProfile) => {
    setSuccess("");
    onChange({ ...selection, profile: next });
  };
  const options = (next: Partial<MappingProfile["options"]>) =>
    update({ ...profile, options: { ...profile.options, ...next } });
  const renderField = (key: string) => {
    const field = canonicalFields[profile.entity].find((f) => f.key === key)!,
      label = t(`fields.${key}`);
    const raw = profile.options.defaults[key],
      value = raw === undefined || raw === null ? "" : String(raw);
    const setDefault = (next: string) =>
      options({ defaults: { ...profile.options.defaults, [key]: next } });
    return (
      <div key={key} className="form-grid">
        <NativeSelectField
          label={label}
          value={
            profile.mapping[key] === null || profile.mapping[key] === undefined
              ? ""
              : String(profile.mapping[key])
          }
          placeholder={t("noColumn")}
          options={(header?.values ?? []).map((v, i) => ({
            value: String(i),
            label: `${i + 1}: ${normalizeText(v) || t("unnamedColumn")}`,
          }))}
          onValueChange={(v) =>
            update({
              ...profile,
              mapping: {
                ...profile.mapping,
                [key]: v === "" ? null : Number(v),
              },
            })
          }
        />
        {key === "notes" ? (
          <Textarea
            label={t("defaultValue", { field: label })}
            value={value}
            maxLength={5000}
            rows={2}
            onChange={(e) => setDefault(e.target.value)}
          />
        ) : (
          <Input
            label={t("defaultValue", { field: label })}
            value={value}
            type={field.type === "date" ? "date" : "text"}
            inputMode={
              ["money", "quantity", "percentage"].includes(field.type)
                ? "decimal"
                : "text"
            }
            maxLength={200}
            onChange={(e) => setDefault(e.target.value)}
          />
        )}
      </div>
    );
  };
  return (
    <section
      className="stack"
      aria-label={t("sheetMapping", { sheet: sheet.name })}
    >
      <h2 className="wrap-value">{sheet.name}</h2>
      <Checkbox
        label={t("includeSheet", { sheet: sheet.name })}
        checked={selection.enabled}
        disabled={pending}
        onCheckedChange={(v) => onChange({ ...selection, enabled: v === true })}
      />
      {selection.enabled && (
        <>
          <fieldset className="stack" disabled={pending}>
            <legend>{t("mappingSettings")}</legend>
            <div className="form-grid">
              <NativeSelectField
                label={t("entity")}
                value={profile.entity}
                options={allowedEntities.map((value) => ({
                  value,
                  label: t(`entities.${value}`),
                }))}
                placeholder={t(`entities.${profile.entity}`)}
                onValueChange={(v) => {
                  if (!allowedEntities.includes(v as ImportEntity)) return;
                  const entity = v as ImportEntity;
                  onChange({
                    ...selection,
                    profileId: null,
                    profile: {
                      ...profile,
                      entity,
                      mapping: suggestMapping(header?.values ?? [], entity),
                      options: {
                        ...profile.options,
                        defaults: {},
                        mode: entity === "orders" ? "insert_only" : "upsert",
                      },
                    },
                  });
                }}
              />
              <NativeSelectField
                label={t("headerRow")}
                value={String(profile.header_row)}
                placeholder={t("headerRow")}
                options={sheet.rows
                  .filter((r) => r.number <= 1000)
                  .map((r) => ({
                    value: String(r.number),
                    label: `${r.number}: ${r.values.slice(0, 3).map(normalizeText).join(" · ")}`,
                  }))}
                onValueChange={(v) => {
                  const row = sheet.rows.find((r) => r.number === Number(v));
                  if (row)
                    update({
                      ...profile,
                      header_row: row.number,
                      mapping: suggestMapping(row.values, profile.entity),
                    });
                }}
              />
              <NativeSelectField
                label={t("savedProfiles")}
                value={selection.profileId ?? ""}
                options={available.map((p) => ({ value: p.id, label: p.name }))}
                placeholder={t("newProfile")}
                onValueChange={(v) => {
                  const chosen = available.find((p) => p.id === v);
                  if (chosen) {
                    const { id, ...data } = chosen;
                    onChange({
                      ...selection,
                      profileId: id,
                      profile: { ...data, sheet_name: sheet.name },
                    });
                  } else onChange({ ...selection, profileId: null });
                  setSuccess("");
                }}
              />
              <Input
                ref={nameRef}
                label={t("profileName")}
                value={profile.name}
                maxLength={200}
                onChange={(e) => update({ ...profile, name: e.target.value })}
              />
            </div>
            <p>{t("mappingHint")}</p>
            <fieldset className="stack">
              <legend>{t("requiredFields")}</legend>
              {canonicalFields[profile.entity]
                .filter((f) => f.required)
                .map((f) => renderField(f.key))}
            </fieldset>
            <details className="stack">
              <summary>{t("optionalFields")}</summary>
              <div className="stack">
                {canonicalFields[profile.entity]
                  .filter((f) => !f.required)
                  .map((f) => renderField(f.key))}
              </div>
            </details>
            <div className="form-grid">
              <NativeSelectField
                label={t("numberFormat")}
                value={profile.options.numberFormat}
                placeholder={t("italianNumbers")}
                options={[
                  { value: "it", label: t("italianNumbers") },
                  { value: "en", label: t("englishNumbers") },
                ]}
                onValueChange={(v) => {
                  if (v === "it" || v === "en") options({ numberFormat: v });
                }}
              />
              <NativeSelectField
                label={t("dateFormat")}
                value={profile.options.dateFormat}
                placeholder={t("dayFirst")}
                options={[
                  { value: "dmy", label: t("dayFirst") },
                  { value: "ymd", label: t("yearFirst") },
                ]}
                onValueChange={(v) => {
                  if (v === "dmy" || v === "ymd") options({ dateFormat: v });
                }}
              />
              <NativeSelectField
                label={t("importMode")}
                value={profile.options.mode}
                placeholder={t("insertOnly")}
                options={[
                  { value: "insert_only", label: t("insertOnly") },
                  { value: "upsert", label: t("upsert") },
                ]}
                onValueChange={(v) => {
                  if (v === "insert_only" || v === "upsert")
                    options({ mode: v });
                }}
              />
              {profile.entity === "orders" && (
                <>
                  <NativeSelectField
                    label={t("granularity")}
                    value={profile.options.granularity}
                    placeholder={t("orderLines")}
                    options={[
                      { value: "order_lines", label: t("orderLines") },
                      { value: "order_totals", label: t("orderTotals") },
                    ]}
                    onValueChange={(v) => {
                      if (v === "order_lines" || v === "order_totals")
                        options({ granularity: v });
                    }}
                  />
                  <NativeSelectField
                    label={t("percentageScale")}
                    value={profile.options.percentageScale}
                    placeholder={t("percentPoints")}
                    options={[
                      { value: "percent", label: t("percentPoints") },
                      { value: "ratio", label: t("percentRatio") },
                    ]}
                    onValueChange={(v) => {
                      if (v === "percent" || v === "ratio")
                        options({ percentageScale: v });
                    }}
                  />
                  <NativeSelectField
                    label={t("initialStatus")}
                    value={profile.options.initialStatus}
                    placeholder={t("draftStatus")}
                    options={[
                      { value: "draft", label: t("draftStatus") },
                      { value: "confirmed", label: t("confirmedStatus") },
                    ]}
                    onValueChange={(v) => {
                      if (v === "draft" || v === "confirmed")
                        options({ initialStatus: v });
                    }}
                  />
                </>
              )}
            </div>
            {allowedEntities.length > 1 && profile.entity !== "customers" && (
              <Checkbox
                label={t("allowCreateSeasons")}
                checked={profile.options.allowCreateSeasons}
                onCheckedChange={(v) =>
                  options({ allowCreateSeasons: v === true })
                }
              />
            )}
            <Button
              variant="secondary"
              size="lg"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError("");
                  setSuccess("");
                  if (!mappingProfileSchema.safeParse(profile).success) {
                    setError(t("profileValidation"));
                    if (!profile.name.trim()) nameRef.current?.focus();
                    return;
                  }
                  try {
                    const result = await saveMappingProfile(
                      selection.profileId,
                      profile,
                    );
                    if (!result.ok)
                      setError(
                        t(
                          result.error === "validation"
                            ? "profileValidation"
                            : result.error,
                        ),
                      );
                    else {
                      onChange({ ...selection, profileId: result.data });
                      setSuccess(t("profileSaved", { name: profile.name }));
                    }
                  } catch {
                    setError(t("saveError"));
                  }
                })
              }
            >
              {t("saveProfile")}
            </Button>
          </fieldset>
          <Alert open={!!error} tone="danger" title={error} />
          <Alert open={!!success} tone="success" title={success} />
        </>
      )}
    </section>
  );
}

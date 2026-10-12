"use client";
import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { WriteButton } from "@/components/pwa/write-button";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { NativeSelectField } from "@/components/shared/native-select-field";
import type { MatchingReport } from "../match-schema";
import { resolveImportMatch } from "../match-actions";
export function MatchEditor({
  id,
  revision,
  item,
  readonly = false,
}: {
  id: string;
  revision: string;
  item: MatchingReport["items"][number];
  readonly?: boolean;
}) {
  const t = useTranslations("imports"),
    router = useRouter(),
    [pending, start] = useTransition(),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [confirm, setConfirm] = useState(false),
    cancel = useRef<HTMLButtonElement>(null);
  const exact = item.candidates.filter((c) => c.exact),
    choice = item.choice;
  const [value, setValue] = useState(
    choice
      ? choice.action === "link"
        ? `${choice.type}:${choice.id}`
        : choice.action
      : exact.length === 1
        ? `${exact[0].type}:${exact[0].id}`
        : "",
  );
  async function save() {
    setError("");
    setSuccess(false);
    if (!value) {
      setError(t("chooseMatch"));
      return;
    }
    const selected = item.candidates.find((c) => `${c.type}:${c.id}` === value),
      choice = selected
        ? { action: "link" as const, type: selected.type, id: selected.id }
        : value === "create"
          ? { action: "create" as const }
          : { action: "ignore" as const };
    try {
      const result = await resolveImportMatch({
        id,
        revision,
        kind: item.kind,
        subject: item.subject,
        choice,
      });
      if (!result.ok) setError(t(result.error));
      else {
        setConfirm(false);
        setSuccess(true);
        router.refresh();
      }
    } catch {
      setError(t("matchError"));
    }
  }
  const label = t(`matchKinds.${item.kind}`),
    source = item.subject.filter(Boolean).join(" · ");
  return (
    <section
      className="stack"
      aria-label={t("matchSection", { kind: label, source })}
    >
      <h3 className="wrap-value">
        {label}: {source}
      </h3>
      {readonly ? (
        <p>
          {choice
            ? t(
                choice.action === "link"
                  ? "matchLinked"
                  : choice.action === "create"
                    ? choice.created_id
                      ? "matchCreated"
                      : "matchCreate"
                    : "matchIgnore",
              )
            : t("matchPending")}
        </p>
      ) : (
        <>
          <NativeSelectField
            label={t("matchSelection", { kind: label, source })}
            value={value}
            disabled={pending}
            placeholder={t("chooseMatch")}
            options={[
              ...item.candidates.map((c) => ({
                value: `${c.type}:${c.id}`,
                label:
                  c.type === "row"
                    ? t("pendingStore", { name: c.label })
                    : c.label,
              })),
              ...(item.can_create
                ? [{ value: "create", label: t("matchCreate") }]
                : []),
              { value: "ignore", label: t("matchIgnore") },
            ]}
            onValueChange={(v) => {
              setValue(v);
              setSuccess(false);
              setError("");
            }}
          />
          {!choice && exact.length === 1 && <p>{t("matchSuggested")}</p>}
          <WriteButton
            variant="secondary"
            size="lg"
            disabled={pending}
            onClick={() => {
              if (value === "create" || value === "ignore") setConfirm(true);
              else start(save);
            }}
          >
            {t("saveMatch")}
          </WriteButton>
          <ResponsiveDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={
              value === "create" ? t("confirmCreation") : t("confirmExclusion")
            }
            description={
              value === "create"
                ? t("creationHint", { source })
                : t("exclusionHint", { source })
            }
            busy={pending}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancel.current?.focus();
            }}
          >
            <div className="report-actions">
              <Button
                ref={cancel}
                variant="secondary"
                size="lg"
                disabled={pending}
                onClick={() => setConfirm(false)}
              >
                {t("cancel")}
              </Button>
              <WriteButton
                size="lg"
                disabled={pending}
                onClick={() => start(save)}
              >
                {value === "create"
                  ? t("confirmCreation")
                  : t("confirmExclusion")}
              </WriteButton>
            </div>
            <Alert open={!!error} tone="danger" title={error} />
          </ResponsiveDialog>
          <Alert open={!!error && !confirm} tone="danger" title={error} />
          <Alert open={success} tone="success" title={t("matchSaved")} />
        </>
      )}
    </section>
  );
}

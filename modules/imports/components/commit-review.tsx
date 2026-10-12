"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/arc/input/input";
import { Button } from "@/components/arc/button/button";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { Alert } from "@/components/arc/alert/alert";
import { WriteButton } from "@/components/pwa/write-button";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { DataTable } from "@/components/shared/data-table";
import { AnimatedMoney } from "@/components/shared/animated-number";
import { normalizeCents } from "../normalize";
import { centsToDecimal, formatMoney } from "@/lib/money";
import type { OperationalPreview } from "../preview-schema";
import { commitOperationalImport, setImportExpected } from "../commit-actions";
export function CommitReview({
  id,
  revision,
  report,
  canEdit,
  canCommit,
  completed,
}: {
  id: string;
  revision: string;
  report: OperationalPreview;
  canEdit: boolean;
  canCommit: boolean;
  completed: boolean;
}) {
  const t = useTranslations("imports"),
    router = useRouter(),
    [pending, start] = useTransition(),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [dirty, setDirty] = useState(false),
    [confirm, setConfirm] = useState(false),
    [updates, setUpdates] = useState(false),
    [differences, setDifferences] = useState(false),
    cancel = useRef<HTMLButtonElement>(null);
  const brands = [...new Set(report.totals.map((g) => g.brand))],
    initial = Object.fromEntries(
      Object.entries(report.expected).map(([k, v]) => [
        k,
        centsToDecimal(BigInt(v)),
      ]),
    ),
    [expected, setExpected] = useState<Record<string, string>>(initial);
  const totals = Object.fromEntries(
    brands.map((brand) => [
      brand,
      report.totals
        .filter((g) => g.brand === brand)
        .reduce((sum, g) => sum + BigInt(g.net_cents), 0n),
    ]),
  );
  const hasDifferences = Object.entries(report.expected).some(
    ([brand, cents]) => (totals[brand] ?? 0n) !== BigInt(cents),
  );
  const formatField = (field: string, value: string | number | null) =>
    value === null
      ? t("notSpecified")
      : field.endsWith("_cents") && value !== ""
        ? formatMoney(BigInt(value))
        : String(value);
  return (
    <section className="stack" aria-label={t("commitSummary")}>
      <h2>{t("commitSummary")}</h2>
      <dl className="report-metrics">
        <div>
          <dt>{t("operationalNet")}</dt>
          <dd>
            <AnimatedMoney
              cents={report.totals.reduce(
                (sum, g) => sum + BigInt(g.net_cents),
                0n,
              )}
            />
          </dd>
        </div>
        <div>
          <dt>{t("operationalGross")}</dt>
          <dd>
            {report.totals.some((g) => g.gross_cents === null) ? (
              t("notComparable")
            ) : (
              <AnimatedMoney
                cents={report.totals.reduce(
                  (sum, g) => sum + BigInt(g.gross_cents!),
                  0n,
                )}
              />
            )}
          </dd>
        </div>
      </dl>
      <DataTable
        caption={t("brandTotals")}
        emptyMessage={t("noOrderTotals")}
        rows={report.totals.map((g) => ({
          id: JSON.stringify([g.brand, g.season]),
          brand: g.brand,
          season: g.season,
          orders: g.orders,
          customers: g.customers,
          pieces: g.pieces,
          net: formatMoney(BigInt(g.net_cents)),
          gross:
            g.gross_cents === null
              ? t("notComparable")
              : formatMoney(BigInt(g.gross_cents)),
        }))}
        columns={[
          { key: "brand", label: t("fields.brand") },
          { key: "season", label: t("fields.season") },
          { key: "orders", label: t("entities.orders"), numeric: true },
          { key: "customers", label: t("entities.customers"), numeric: true },
          { key: "pieces", label: t("fields.quantity"), numeric: true },
          { key: "net", label: t("operationalNet"), numeric: true },
          { key: "gross", label: t("operationalGross"), numeric: true },
        ]}
      />
      {!completed && (
        <>
          {(report.problem_count > 0 ||
            report.errors > 0 ||
            !report.complete) && (
            <Alert
              tone="warning"
              title={t("commitBlocked", {
                count: report.problem_count + report.errors,
              })}
            />
          )}
          {report.problems.map((p) => (
            <p key={`${p.sheet}:${p.row}`} className="wrap-value">
              {t("rowProblem", {
                sheet: p.sheet,
                row: p.row,
                reason: t(`problems.${p.code}`),
              })}
            </p>
          ))}
          <h3>{t("plannedChanges")}</h3>
          <p>{t("plannedChangesHint")}</p>
          <DataTable
            caption={t("plannedChanges")}
            emptyMessage={t("noPreviewRows")}
            rows={report.operations.map((op) => ({
              id: op.row_id,
              sheet: op.sheet,
              row: op.row,
              entity: t(`entities.${op.entity}`),
              action: t(`operations.${op.action}`),
              changes: op.changes
                .map((c) =>
                  t("fieldChange", {
                    field: t.has(`fields.${c.field}`)
                      ? t(`fields.${c.field}`)
                      : c.field,
                    before: formatField(c.field, c.before),
                    after: formatField(c.field, c.after),
                  }),
                )
                .join("; "),
            }))}
            columns={[
              { key: "sheet", label: t("rowSheet") },
              { key: "row", label: t("sourceRow"), numeric: true },
              { key: "entity", label: t("entity") },
              { key: "action", label: t("plannedAction") },
              { key: "changes", label: t("fieldChanges") },
            ]}
          />
          {canEdit && brands.length > 0 && (
            <fieldset className="stack" disabled={pending}>
              <legend>{t("expectedByBrand")}</legend>
              <p>{t("expectedByBrandHint")}</p>
              {brands.map((brand) => (
                <Input
                  key={brand}
                  label={t("expectedBrand", { brand })}
                  inputMode="decimal"
                  value={expected[brand] ?? ""}
                  onChange={(e) => {
                    setDirty(true);
                    setExpected((old) => ({ ...old, [brand]: e.target.value }));
                    setSaved(false);
                  }}
                />
              ))}
              <WriteButton
                variant="secondary"
                size="lg"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError("");
                    setSaved(false);
                    const normalized: Record<string, string> = {};
                    for (const [brand, value] of Object.entries(expected)) {
                      if (!value.trim()) continue;
                      const cents = normalizeCents(value);
                      if (cents === null) {
                        setError(t("expectedInvalid", { brand }));
                        return;
                      }
                      normalized[brand] = String(cents);
                    }
                    try {
                      const result = await setImportExpected(
                        id,
                        revision,
                        normalized,
                      );
                      if (!result.ok) setError(t(result.error));
                      else {
                        setSaved(true);
                        setDirty(false);
                        router.refresh();
                      }
                    } catch {
                      setError(t("saveError"));
                    }
                  })
                }
              >
                {t("saveExpected")}
              </WriteButton>
            </fieldset>
          )}
          <Alert open={saved} tone="success" title={t("expectedSaved")} />
          {hasDifferences && (
            <Alert tone="warning" title={t("expectedDifferences")} />
          )}
          {canCommit && (
            <WriteButton
              size="lg"
              disabled={
                pending ||
                report.errors > 0 ||
                report.problem_count > 0 ||
                !report.complete
              }
              onClick={() => {
                setError("");
                if (dirty) {
                  setError(t("saveExpectedFirst"));
                  return;
                }
                setUpdates(false);
                setDifferences(false);
                setConfirm(true);
              }}
            >
              {t("confirmOperational")}
            </WriteButton>
          )}
          {!canCommit && <p>{t("adminCommitHint")}</p>}
          <ResponsiveDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={t("confirmOperational")}
            description={t("operationalCommitHint")}
            busy={pending}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancel.current?.focus();
            }}
          >
            <Checkbox
              label={t("confirmUpdates")}
              checked={updates}
              disabled={pending}
              onCheckedChange={(v) => setUpdates(v === true)}
            />
            {hasDifferences && (
              <Checkbox
                label={t("confirmExpectedDifferences")}
                checked={differences}
                disabled={pending}
                onCheckedChange={(v) => setDifferences(v === true)}
              />
            )}
            <Alert open={!!error} tone="danger" title={error} />
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
                onClick={() =>
                  start(async () => {
                    setError("");
                    if (!updates || (hasDifferences && !differences)) {
                      setError(t("confirmRequired"));
                      return;
                    }
                    try {
                      const result = await commitOperationalImport(
                        id,
                        updates,
                        differences,
                      );
                      if (!result.ok) setError(t(result.error));
                      else {
                        setConfirm(false);
                        router.refresh();
                      }
                    } catch {
                      setError(t("saveError"));
                    }
                  })
                }
              >
                {t("confirmAndImport")}
              </WriteButton>
            </div>
          </ResponsiveDialog>
        </>
      )}
      <Alert open={!!error && !confirm} tone="danger" title={error} />
    </section>
  );
}

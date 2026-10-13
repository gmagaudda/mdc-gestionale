"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { Stepper } from "@/components/arc/stepper/stepper";
import { Progress } from "@/components/arc/progress/progress";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { WriteButton } from "@/components/pwa/write-button";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { DataTable } from "@/components/shared/data-table";
import { parseImportFile } from "../parser";
import {
  readPerformanceWorkbook,
  aggregatePerformance,
  sumPerformance,
  selectPivotRows,
  performanceMetrics,
  type PerformanceDataset,
} from "../performance";
import { PerformanceResults } from "./performance-results";
import {
  configurePerformanceBatch,
  stagePerformanceRows,
  completePerformanceBatch,
} from "../actions";
import { formatMoney } from "@/lib/money";
import Link from "next/link";
import { exportCsv } from "@/lib/csv";
type PreparedDataset = PerformanceDataset & {
  totals: ReturnType<typeof sumPerformance>;
  groups: ReturnType<typeof aggregatePerformance>;
};
const emptyTotals = sumPerformance([]);
export function PerformanceImport() {
  const t = useTranslations("imports"),
    router = useRouter();
  const [file, setFile] = useState<File | null>(null),
    [dataset, setDataset] = useState<PreparedDataset | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(0),
    [confirm, setConfirm] = useState(false),
    [batchId, setBatchId] = useState<string | null>(null),
    [duplicate, setDuplicate] = useState<string | null>(null);
  const [issuesReady, setIssuesReady] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const abort = useRef<AbortController | null>(null),
    cancel = useRef<HTMLButtonElement>(null);
  const totals = dataset?.totals ?? emptyTotals,
    groups = dataset?.groups ?? [];
  const differences = dataset
    ? performanceMetrics.filter(
        (m) =>
          dataset.expected[m.key] !== null &&
          (totals[m.key] === null ||
            BigInt(totals[m.key]!) !== BigInt(dataset.expected[m.key]!)),
      )
    : [];
  const blocking = dataset?.issues.some((i) => i.severity === "error");
  const step = dataset ? 1 : 0;
  const translate = (code: string) => (t.has(code) ? t(code) : t("parseError"));
  async function read(selected: File) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setFile(selected);
    setDataset(null);
    setIssuesReady(false);
    setPreviewPage(1);
    setBatchId(null);
    setDuplicate(null);
    setError("");
    setPending(true);
    setProgress(0);
    try {
      if (!selected.size || selected.size > 10485760) throw Error("fileLimit");
      if (!/\.xlsx$/i.test(selected.name)) throw Error("fileType");
      const parsed = await parseImportFile(selected, controller.signal);
      if (controller.signal.aborted) return;
      const result = readPerformanceWorkbook(parsed),
        pivotRows = selectPivotRows(result);
      setDataset({
        ...result,
        totals: sumPerformance(pivotRows),
        groups: aggregatePerformance(pivotRows),
      });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          translate(cause instanceof Error ? cause.message : "parseError"),
        );
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }
  async function save() {
    if (!file || !dataset || blocking) return;
    setConfirm(false);
    setError("");
    setPending(true);
    try {
      let id = batchId;
      if (!id) {
        const form = new FormData();
        form.set("kind", "performance");
        form.set("file", file);
        const response = await fetch("/api/imports/upload", {
          method: "POST",
          body: form,
        });
        const result = await response.json();
        if (!response.ok && !result.resume) {
          if (result.error === "duplicateFile") setDuplicate(result.id);
          throw Error(result.error);
        }
        id = String(result.id);
        setBatchId(id);
      }
      const config = await configurePerformanceBatch(id, {
        sheet: dataset.sheet,
        pivotBrands: dataset.pivotBrands,
        expected: dataset.expected,
      });
      if (!config.ok) throw Error(config.error);
      for (let i = 0; i < dataset.rows.length; i += 500) {
        const staged = await stagePerformanceRows(
          id,
          dataset.sheet,
          dataset.rows.slice(i, i + 500),
        );
        if (!staged.ok) throw Error(staged.error);
        setProgress(Math.min(i + 500, dataset.rows.length));
      }
      const committed = await completePerformanceBatch(
        id,
        differences.length > 0,
      );
      if (!committed.ok) throw Error(committed.error);
      router.push(`/analysis?batch=${id}&imported=1`);
      router.refresh();
    } catch (cause) {
      setError(translate(cause instanceof Error ? cause.message : "saveError"));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="stack">
      <div aria-hidden="true" inert>
        <Stepper
          steps={[
            { id: "file", label: t("fileStep") },
            { id: "check", label: t("checkStep") },
            { id: "report", label: t("reportStep") },
          ]}
          current={step}
          label={t("steps")}
          completeLabel={t("complete")}
        />
      </div>
      <p role="status">
        {pending
          ? dataset
            ? t("staging")
            : t("reading")
          : dataset
            ? t("ready")
            : t("chooseFile")}
      </p>
      {error && <Alert tone="danger" title={error} />}
      {duplicate && (
        <Link className="text-link" href={`/analysis?batch=${duplicate}`}>
          {t("openExisting")}
        </Link>
      )}
      {!file && (
        <div
          onPasteCapture={(e) => {
            if (e.clipboardData.files.length > 1) {
              e.preventDefault();
              e.stopPropagation();
              setError(t("oneFile"));
            }
          }}
          onDropCapture={(e) => {
            if (e.dataTransfer.files.length > 1) {
              e.preventDefault();
              e.stopPropagation();
              setError(t("oneFile"));
            }
          }}
        >
          <FileDropzone
            multiple={false}
            maxFiles={1}
            label={t("chooseFile")}
            description={t("fileHint")}
            note={t("limits")}
            dropLabel={t("dropFile")}
            onFilesChange={(files) => {
              if (files[0]) void read(files[0]);
            }}
          />
        </div>
      )}
      {file && (
        <>
          <p className="wrap-value">{t("sourceFile", { name: file.name })}</p>
          <Button
            variant="secondary"
            size="lg"
            disabled={pending}
            onClick={() => {
              abort.current?.abort();
              setFile(null);
              setDataset(null);
              setError("");
              setDuplicate(null);
            }}
          >
            {t("chooseAnother")}
          </Button>
        </>
      )}
      {pending && !dataset && (
        <>
          <Skeleton lines={4} />
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              abort.current?.abort();
              setPending(false);
              setFile(null);
            }}
          >
            {t("cancel")}
          </Button>
        </>
      )}
      {pending && dataset && (
        <Progress
          label={t("staging")}
          value={progress}
          max={dataset.rows.length}
        />
      )}
      {dataset && (
        <>
          <p>
            {t("previewHint", {
              all: dataset.rows.length,
              brands: dataset.pivotBrands.length,
            })}
          </p>
          {dataset.issues.length > 0 && (
            <>
              <Alert
                tone={blocking ? "danger" : "warning"}
                title={t("issueCount", { count: dataset.issues.length })}
              />
              <DataTable
                caption={t("issues")}
                rows={dataset.issues.slice(0, 100).map((i) => ({
                  id: `${i.row}:${i.column}:${i.code}`,
                  row: i.row,
                  column: i.column,
                  message: t(i.code),
                }))}
                columns={[
                  { key: "row", label: t("sourceRow") },
                  { key: "column", label: t("column") },
                  { key: "message", label: t("reason") },
                ]}
                emptyMessage={t("noIssues")}
              />
              {dataset.issues.length > 100 && (
                <p>{t("shownIssues", { total: dataset.issues.length })}</p>
              )}
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  const csv = exportCsv(
                    [t("sourceRow"), t("column"), t("reason")],
                    dataset.issues.map((i) => [i.row, i.column, t(i.code)]),
                  );
                  const url = URL.createObjectURL(
                      new Blob([csv], { type: "text/csv;charset=utf-8" }),
                    ),
                    link = document.createElement("a");
                  link.href = url;
                  link.download = "segnalazioni-importazione.csv";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                  setIssuesReady(true);
                }}
              >
                {t("exportIssues")}
              </Button>
              {issuesReady && <p role="status">{t("exported")}</p>}
            </>
          )}
          <PerformanceResults
            groups={groups
              .slice((previewPage - 1) * 100, previewPage * 100)
              .map((g) => ({
                label: g.label,
                rows: g.rows,
                customers: g.customers,
                ...g.values,
              }))}
            totals={{
              rows: groups.reduce((sum, g) => sum + g.rows, 0),
              ...totals,
            }}
            count={groups.length}
            dimension="brand"
          />
          {groups.length > 100 && (
            <nav className="report-actions" aria-label={t("pages")}>
              <p role="status">
                {t("pageStatus", {
                  page: previewPage,
                  pages: Math.ceil(groups.length / 100),
                })}
              </p>
              {previewPage > 1 && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setPreviewPage((p) => p - 1)}
                >
                  {t("previous")}
                </Button>
              )}
              {previewPage * 100 < groups.length && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setPreviewPage((p) => p + 1)}
                >
                  {t("next")}
                </Button>
              )}
            </nav>
          )}
          <section className="stack" aria-label={t("controls")}>
            <h2>{t("controls")}</h2>
            <p>{t("controlsHint")}</p>
            <DataTable
              caption={t("controls")}
              rows={performanceMetrics.map((m) => ({
                id: m.key,
                metric: t(`metrics.${m.key}`),
                calculated:
                  totals[m.key] === null
                    ? t("missingValue")
                    : formatMoney(BigInt(totals[m.key]!)),
                expected:
                  dataset.expected[m.key] === null
                    ? t("missingValue")
                    : formatMoney(BigInt(dataset.expected[m.key]!)),
                difference:
                  dataset.expected[m.key] === null || totals[m.key] === null
                    ? t("missingValue")
                    : formatMoney(
                        BigInt(totals[m.key] ?? "0") -
                          BigInt(dataset.expected[m.key]!),
                      ),
              }))}
              columns={[
                { key: "metric", label: t("indicator") },
                { key: "calculated", label: t("calculated"), numeric: true },
                { key: "expected", label: t("expected"), numeric: true },
                { key: "difference", label: t("difference"), numeric: true },
              ]}
              emptyMessage={t("noResults")}
            />
          </section>
          {differences.length > 0 && (
            <Alert tone="warning" title={t("totalDifferences")} />
          )}
          <ResponsiveDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={t("confirmTitle")}
            description={
              differences.length ? t("confirmDifferences") : t("confirmHint")
            }
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              cancel.current?.focus();
            }}
            trigger={
              <WriteButton
                size="lg"
                disabled={pending || blocking || !dataset.rows.length}
              >
                {t("saveHistorical")}
              </WriteButton>
            }
          >
            <div className="form-actions report-actions">
              <Button
                ref={cancel}
                variant="secondary"
                size="lg"
                onClick={() => setConfirm(false)}
              >
                {t("cancel")}
              </Button>
              <WriteButton size="lg" onClick={() => void save()}>
                {t("confirmSave")}
              </WriteButton>
            </div>
          </ResponsiveDialog>
        </>
      )}
    </div>
  );
}

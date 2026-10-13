"use client";
import { TablePagination } from "@/components/shared/table-pagination";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone";
import { Stepper } from "@/components/arc/stepper/stepper";
import { Progress } from "@/components/arc/progress/progress";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { WriteButton } from "@/components/pwa/write-button";
import { DataTable } from "@/components/shared/data-table";
import { NativeSelectField } from "@/components/shared/native-select-field";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { exportCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/money";
import { canonicalFields, type ImportEntity } from "../fields";
import { inferMappingProfile } from "../mapping";
import { parseImportFile, type ParsedWorkbook } from "../parser";
import { importChunks } from "../chunks";
import { normalizeMappedSheet, type NormalizedImportRow } from "../validation";
import {
  configureOperationalBatch,
  stageOperationalRows,
  finishOperationalStaging,
} from "../operational-actions";
import {
  MappingEditor,
  type SheetMapping,
  type SavedMappingProfile,
} from "./mapping-editor";
export function OperationalImport({
  allowedEntities,
  profiles,
}: {
  allowedEntities: readonly ImportEntity[];
  profiles: SavedMappingProfile[];
}) {
  const t = useTranslations("imports");
  const [file, setFile] = useState<File | null>(null),
    [book, setBook] = useState<ParsedWorkbook | null>(null),
    [mapping, setMapping] = useState<SheetMapping[]>([]),
    [preview, setPreview] = useState<NormalizedImportRow[] | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [resumed, setResumed] = useState(false),
    [progress, setProgress] = useState(0),
    [batch, setBatch] = useState<string | null>(null),
    [staged, setStaged] = useState(false),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(1),
    [reportReady, setReportReady] = useState(false);
  const abort = useRef<AbortController | null>(null),
    previewHeading = useRef<HTMLHeadingElement>(null);
  const translate = (code: string) =>
    code === "fileType"
      ? t("operationalFileType")
      : t.has(code)
        ? t(code)
        : t("saveError");
  const enabled = mapping.filter((s) => s.enabled),
    filtered = preview?.filter((r) => !filter || r.status === filter) ?? [],
    count = (status: string) =>
      preview?.filter((r) => r.status === status).length ?? 0;
  async function read(selected: File) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setResumed(false);
    setFile(selected);
    setBook(null);
    setPreview(null);
    setBatch(null);
    setStaged(false);
    setError("");
    setPending(true);
    setReportReady(false);
    try {
      if (!selected.size || selected.size > 10485760) throw Error("fileLimit");
      if (!/\.(xlsx|csv)$/i.test(selected.name)) throw Error("fileType");
      const parsed = await parseImportFile(selected, controller.signal);
      if (controller.signal.aborted) return;
      setBook(parsed);
      setMapping(
        parsed.sheets.map((sheet) => {
          const profile = inferMappingProfile(sheet, allowedEntities);
          const required = canonicalFields[profile.entity].filter(
            (f) => f.required,
          );
          return {
            profile,
            profileId: null,
            enabled: required.every((f) => profile.mapping[f.key] !== null),
          };
        }),
      );
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          translate(cause instanceof Error ? cause.message : "parseError"),
        );
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }
  function verify() {
    setError("");
    setStaged(false);
    setReportReady(false);
    if (!book || !enabled.length) {
      setError(t("noSheets"));
      return;
    }
    const rows = enabled.flatMap((s) =>
      normalizeMappedSheet(
        book.sheets.find((b) => b.name === s.profile.sheet_name)!,
        s.profile,
      ),
    );
    setPreview(rows);
    setPage(1);
    setFilter("");
    requestAnimationFrame(() => previewHeading.current?.focus());
  }
  async function stage() {
    if (!book || !file || !preview?.length) return;
    setPending(true);
    setError("");
    setProgress(0);
    try {
      let id = batch;
      if (!id) {
        const form = new FormData();
        form.set("file", file);
        form.set(
          "kind",
          allowedEntities.length === 1 ? allowedEntities[0] : "mixed",
        );
        const response = await fetch("/api/imports/upload", {
            method: "POST",
            body: form,
          }),
          result = await response.json();
        if (!response.ok && !result.resume) throw Error(result.error);
        id = String(result.id);
        if (result.resume) setResumed(true);
        setBatch(id);
      }
      const config = await configureOperationalBatch(id, {
        profiles: enabled.map((s) => s.profile),
      });
      if (!config.ok) throw Error(config.error);
      let done = 0;
      for (const s of enabled) {
        const rows = book.sheets
          .find((b) => b.name === s.profile.sheet_name)!
          .rows.filter((r) => r.number > s.profile.header_row);
        for (const chunk of importChunks(rows)) {
          const result = await stageOperationalRows(
            id,
            s.profile.sheet_name,
            config.data,
            chunk,
          );
          if (!result.ok) throw Error(result.error);
          done += chunk.length;
          setProgress(done);
        }
      }
      const finished = await finishOperationalStaging(
        id,
        config.data,
        Object.fromEntries(
          enabled.map((s) => [
            s.profile.sheet_name,
            book.sheets
              .find((b) => b.name === s.profile.sheet_name)!
              .rows.filter((r) => r.number > s.profile.header_row).length,
          ]),
        ),
      );
      if (!finished.ok) throw Error(finished.error);
      setStaged(true);
    } catch (cause) {
      setError(translate(cause instanceof Error ? cause.message : "saveError"));
    } finally {
      setPending(false);
    }
  }
  const message = (r: NormalizedImportRow) =>
    r.messages
      .map(
        (m) =>
          `${m.field ? t(`fields.${m.field}`) + ": " : ""}${t(`row${m.code.charAt(0).toUpperCase() + m.code.slice(1)}`)}`,
      )
      .join(" ");
  const values = (r: NormalizedImportRow) =>
    canonicalFields[r.entity]
      .filter((f) => r.mapped[f.key] !== undefined && r.mapped[f.key] !== "")
      .map(
        (f) =>
          `${t(`fields.${f.key}`)}: ${f.type === "money" ? formatMoney(BigInt(r.mapped[f.key])) : String(r.mapped[f.key])}`,
      )
      .join("; ");
  function downloadReport() {
    const csv = exportCsv(
      [t("rowSheet"), t("sourceRow"), t("status"), t("rowMessages")],
      (preview ?? [])
        .filter((r) => r.messages.length)
        .map((r) => [
          r.sheet,
          r.row_number,
          t(`row${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`),
          message(r),
        ]),
    );
    const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "controlli-importazione.csv";
    a.click();
    URL.revokeObjectURL(url);
    setReportReady(true);
  }
  return (
    <div className="stack">
      <div aria-hidden="true" inert>
        <Stepper
          steps={[
            { id: "file", label: t("fileStep") },
            { id: "mapping", label: t("mappingStep") },
            { id: "validation", label: t("validationStep") },
            { id: "matching", label: t("matchingStep") },
          ]}
          current={staged ? 3 : preview ? 2 : book ? 1 : 0}
          label={t("steps")}
          completeLabel={t("complete")}
        />
      </div>
      <p role="status">
        {pending
          ? book
            ? t("operationalStaging")
            : t("reading")
          : staged
            ? t("stageReady")
            : book
              ? t("mappingHint")
              : t("chooseOperationalFile")}
      </p>
      {error && <Alert tone="danger" title={error} />}
      {resumed && <Alert tone="info" title={t("resumeNotice")} />}
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
            label={t("chooseOperationalFile")}
            description={t("operationalFileHint")}
            note={t("operationalLimits")}
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
            disabled={pending && !!book}
            onClick={() => {
              abort.current?.abort();
              setFile(null);
              setBook(null);
              setPreview(null);
              setBatch(null);
              setPending(false);
              setStaged(false);
              setError("");
            }}
          >
            {pending && !book ? t("cancel") : t("chooseAnother")}
          </Button>
        </>
      )}
      {pending && !book && <Skeleton lines={4} />}
      {pending && book && (
        <Progress
          label={t("operationalStaging")}
          value={progress}
          max={preview?.length ?? 1}
        />
      )}
      {book && !preview && (
        <>
          <fieldset className="stack" disabled={pending}>
            {book.sheets.map((sheet, index) => (
              <MappingEditor
                key={sheet.name}
                sheet={sheet}
                selection={mapping[index]}
                allowedEntities={allowedEntities}
                profiles={profiles}
                onChange={(selection) => {
                  setMapping((old) =>
                    old.map((s, i) => (i === index ? selection : s)),
                  );
                  setPreview(null);
                  setStaged(false);
                }}
              />
            ))}
          </fieldset>
          <Button size="lg" onClick={verify} disabled={pending}>
            {t("verifyRows")}
          </Button>
        </>
      )}
      {preview && (
        <section className="stack" aria-label={t("previewRows")}>
          <h2 ref={previewHeading} tabIndex={-1}>
            {t("previewRows")}
          </h2>
          <dl className="report-metrics">
            {["valid", "warning", "error", "skipped"].map((status) => (
              <div key={status}>
                <dt>
                  {t(`row${status.charAt(0).toUpperCase() + status.slice(1)}`)}
                </dt>
                <dd>
                  <AnimatedNumber value={count(status)} />
                </dd>
              </div>
            ))}
          </dl>
          {count("error") > 0 && (
            <Alert tone="warning" title={t("stageWithErrors")} />
          )}
          <NativeSelectField
            label={t("rowFilter")}
            value={filter}
            placeholder={t("allRows")}
            options={["valid", "warning", "error", "skipped"].map((value) => ({
              value,
              label: t(`row${value.charAt(0).toUpperCase() + value.slice(1)}`),
            }))}
            onValueChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
          />
          <DataTable
            caption={t("previewRows")}
            emptyMessage={t("noPreviewRows")}
            rows={filtered.slice((page - 1) * 100, page * 100).map((r) => ({
              id: `${r.sheet}:${r.row_number}:${r.entity}`,
              sheet: r.sheet,
              row: r.row_number,
              status: t(
                `row${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`,
              ),
              values: values(r),
              messages: message(r),
            }))}
            columns={[
              { key: "sheet", label: t("rowSheet") },
              { key: "row", label: t("sourceRow"), numeric: true },
              { key: "status", label: t("status") },
              { key: "values", label: t("mappedValues") },
              { key: "messages", label: t("rowMessages") },
            ]}
          />
          <TablePagination
            page={page}
            pageCount={Math.max(1, Math.ceil(filtered.length / 100))}
            onPageChange={setPage}
          />
          <div className="report-actions">
            <Button
              variant="secondary"
              size="lg"
              disabled={pending}
              onClick={() => {
                setPreview(null);
                setStaged(false);
                setReportReady(false);
              }}
            >
              {t("editMapping")}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              disabled={!preview.some((r) => r.messages.length)}
              onClick={downloadReport}
            >
              {t("exportIssues")}
            </Button>
            {!staged && (
              <WriteButton
                size="lg"
                disabled={pending || !preview.length}
                onClick={() => void stage()}
              >
                {t("prepareMatches")}
              </WriteButton>
            )}
          </div>
          {reportReady && <Alert tone="success" title={t("reportReady")} />}
          {staged && batch && (
            <>
              <Alert tone="success" title={t("stageReady")} />
              <Link className="text-link" href={`/imports/${batch}`}>
                {t("matchingStep")}
              </Link>
            </>
          )}
        </section>
      )}
    </div>
  );
}

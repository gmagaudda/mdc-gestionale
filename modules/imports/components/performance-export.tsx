"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
export function PerformanceExport({
  params,
  compact = false,
}: {
  params: string;
  compact?: boolean;
}) {
  const t = useTranslations("imports"),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  async function download(format: "xlsx" | "csv") {
    setPending(true);
    setError("");
    setReady(false);
    try {
      const response = await fetch(
        `/api/imports/export?${params}&format=${format}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setError(t(response.status === 413 ? "exportLimit" : "exportError"));
        return;
      }
      const url = URL.createObjectURL(await response.blob()),
        link = document.createElement("a");
      link.href = url;
      link.download = `analisi-stagioni.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setReady(true);
    } catch {
      setError(t("exportError"));
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className={compact ? "table-export-actions" : "stack"}
      aria-label={t("exportTitle")}
    >
      {!compact && (
        <>
          <h2>{t("exportTitle")}</h2>
          <p>{t("exportHint")}</p>
        </>
      )}
      <div className="report-actions">
        <Button
          variant="secondary"
          size="lg"
          disabled={pending}
          onClick={() => void download("xlsx")}
        >
          {t("exportXlsx")}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={pending}
          onClick={() => void download("csv")}
        >
          {t("exportCsv")}
        </Button>
      </div>
      <p role="status">
        {pending ? t("exporting") : ready ? t("exported") : ""}
      </p>
      <Alert open={!!error} tone="danger" title={error} />
    </section>
  );
}

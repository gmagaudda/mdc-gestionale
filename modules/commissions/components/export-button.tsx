"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
import { ListCsvDownload } from "@/components/shared/list-csv-download";
export function CommissionExportButton({ params }: { params: string }) {
  const t = useTranslations("commissions"),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  return (
    <div className="table-export-actions">
      <div className="form-actions report-actions">
        <Button
          size="lg"
          variant="secondary"
          loading={pending}
          onClick={async () => {
            setPending(true);
            setError("");
            setReady(false);
            try {
              const response = await fetch(
                `/api/commissions/export?${params}`,
                { cache: "no-store" },
              );
              if (!response.ok) {
                setError(t(response.status === 413 ? "tooLarge" : "loadError"));
                return;
              }
              const url = URL.createObjectURL(await response.blob());
              const link = document.createElement("a");
              link.href = url;
              link.download = "provvigioni.xlsx";
              document.body.append(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setReady(true);
            } catch {
              setError(t("loadError"));
            } finally {
              setPending(false);
            }
          }}
        >
          {t("export")}
        </Button>
      </div>
      <p role="status">
        {pending ? t("exporting") : ready ? t("exported") : ""}
      </p>
      <Alert open={!!error} tone="danger" title={error} />
      <ListCsvDownload
        href={`/api/commissions/export?${params}&format=csv`}
        fileName="provvigioni.csv"
      />
    </div>
  );
}

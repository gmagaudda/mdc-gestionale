"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
export function ListCsvDownload({
  href,
  fileName,
  label,
}: {
  href: string;
  fileName: string;
  label?: string;
}) {
  const t = useTranslations("lists");
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="stack">
      <Button
        variant="secondary"
        size="lg"
        loading={pending}
        onClick={async () => {
          setPending(true);
          setReady(false);
          setError("");
          try {
            const response = await fetch(href, { cache: "no-store" });
            if (!response.ok) {
              setError(
                t(response.status === 413 ? "exportTooLarge" : "exportError"),
              );
              return;
            }
            if (!response.headers.get("content-type")?.startsWith("text/csv"))
              throw Error("Invalid export response");
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
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
        }}
      >
        <span className="list-button-copy">{label ?? t("exportCsv")}</span>
      </Button>
      <p role="status" className={pending || ready ? undefined : "sr-only"}>
        {pending ? t("exporting") : ready ? t("exportReady") : ""}
      </p>
      <Alert open={!!error} tone="danger" title={error} />
    </div>
  );
}

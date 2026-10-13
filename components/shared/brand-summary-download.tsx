"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Alert } from "@/components/arc/alert/alert";
export function BrandSummaryDownload({ href }: { href: string }) {
  const t = useTranslations("pdf");
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="stack">
      <div className="form-actions report-actions">
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
                  t(
                    response.status === 413
                      ? "summaryTooLarge"
                      : response.status === 422
                        ? "unsupportedCharacters"
                        : "generationError",
                  ),
                );
                return;
              }
              if (
                !response.headers
                  .get("content-type")
                  ?.startsWith("application/pdf")
              )
                throw Error("Invalid PDF response");
              const url = URL.createObjectURL(await response.blob());
              const link = document.createElement("a");
              link.href = url;
              link.download = "riepilogo-brand.pdf";
              document.body.append(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setReady(true);
            } catch {
              setError(t("generationError"));
            } finally {
              setPending(false);
            }
          }}
        >
          {t("downloadSummary")}
        </Button>
      </div>
      <p role="status">
        {pending ? t("preparingSummary") : ready ? t("summaryReady") : ""}
      </p>
      <Alert open={!!error} tone="danger" title={error} />
    </div>
  );
}

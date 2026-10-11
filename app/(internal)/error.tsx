"use client";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("lists");
  return (
    <Alert tone="danger" title={t("loadError")}>
      <Button variant="secondary" size="lg" onClick={reset}>
        {t("retry")}
      </Button>
    </Alert>
  );
}

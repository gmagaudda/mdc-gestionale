"use client";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
export function LoadError({
  title,
  retry,
}: {
  title: string;
  retry?: () => void;
}) {
  const t = useTranslations("lists");
  return (
    <Alert tone="danger" title={title}>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={retry ?? (() => window.location.reload())}
      >
        {t("retry")}
      </Button>
    </Alert>
  );
}

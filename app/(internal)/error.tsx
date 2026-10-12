"use client";
import { useTranslations } from "next-intl";
import { LoadError } from "@/components/shared/load-error";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("lists");
  return (
    <>
      <h1>{t("errorTitle")}</h1>
      <LoadError title={t("loadError")} retry={reset} />
    </>
  );
}

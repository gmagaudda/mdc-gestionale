import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Alert } from "@/components/arc/alert/alert";
import { ThemeControls } from "@/components/shared/theme-controls";

export default async function DesignCheck() {
  if (process.env.NODE_ENV !== "development") notFound();
  const t = await getTranslations("design");
  return (
    <main className="page-container stack">
      <header className="stack">
        <h1>{t("title")}</h1>
        <p>{t("description")}</p>
      </header>
      <ThemeControls />
      <div className="stack">
        <Input
          label={t("email")}
          type="email"
          autoComplete="email"
          description={t("emailHelp")}
        />
        <Button size="lg">{t("button")}</Button>
        <Alert title={t("alertTitle")}>{t("alertDescription")}</Alert>
      </div>
    </main>
  );
}

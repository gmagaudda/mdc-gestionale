import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/arc/button/button";
import { Avatar } from "@/components/arc/avatar/avatar";
import { AppNavigation } from "./app-navigation";
import { ThemeControls } from "./theme-controls";
import { logout } from "@/modules/auth/actions";
import { type Role } from "@/lib/auth/roles";
export async function SessionShell({
  user,
  children,
}: {
  user: { role: Role; full_name: string; email: string };
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");
  return (
    <>
      <Link href="#content" className="skip-link">
        {t("skip")}
      </Link>
      <div className="app-layout">
        <div className="app-body">
          <header className="session-header">
            <AppNavigation role={user.role} />
            <div className="identity">
              <Avatar name={user.full_name || user.email} />
              <span>{user.full_name || user.email}</span>
            </div>
            <details className="user-preferences">
              <summary className="text-link">{t("preferences")}</summary>
              <ThemeControls />
            </details>
            <form action={logout}>
              <Button type="submit" variant="secondary" size="lg">
                {t("logout")}
              </Button>
            </form>
          </header>
          <main id="content" tabIndex={-1} className="page-container stack">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

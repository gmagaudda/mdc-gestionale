import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/arc/button/button";
import { Avatar } from "@/components/arc/avatar/avatar";
import { ThemeControls } from "./theme-controls";
import { logout } from "@/modules/auth/actions";
import { homeForRole, type Role } from "@/lib/auth/roles";
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
      <header className="session-header">
        <nav aria-label={t("appName")}>
          <Link className="text-link" href={homeForRole(user.role)}>
            {t("dashboard")}
          </Link>
          {user.role !== "brand" && (
            <Link className="text-link" href="/brands">
              {t("brands")}
            </Link>
          )}
          {user.role !== "brand" && (
            <Link className="text-link" href="/customers">
              {t("customers")}
            </Link>
          )}
          {user.role === "admin" && (
            <Link className="text-link" href="/settings/audit">
              {t("audit")}
            </Link>
          )}
          {user.role === "admin" && (
            <Link className="text-link" href="/settings/users">
              {t("users")}
            </Link>
          )}
        </nav>
        <div className="identity">
          <Avatar name={user.full_name || user.email} />
          <span>{user.full_name || user.email}</span>
        </div>
        <form action={logout}>
          <Button type="submit" variant="secondary" size="lg">
            {t("logout")}
          </Button>
        </form>
      </header>
      <main id="content" tabIndex={-1} className="page-container stack">
        {children}
        <ThemeControls />
      </main>
    </>
  );
}

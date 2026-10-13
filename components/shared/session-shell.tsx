import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/arc/avatar/avatar";
import {
  AppNavigation,
  MobileNavigation,
  WorkspacePath,
} from "./app-navigation";
import { ThemeControls } from "./theme-controls";
import { LogoutForm } from "@/components/pwa/logout-form";
import { PwaStatus, PwaInstall } from "@/components/pwa/pwa-status";
import { PushSettings } from "@/components/pwa/push-settings";
import { pushConfig } from "@/lib/pwa/push-config";
import { type Role } from "@/lib/auth/roles";
export async function SessionShell({
  user,
  children,
}: {
  user: { role: Role; full_name: string; email: string };
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");
  const identity = (
    <div className="identity">
      <Avatar name={user.full_name || user.email} />
      <div className="identity-copy">
        <span>{user.full_name || user.email}</span>
        <span className="identity-role">{t(`role_${user.role}`)}</span>
      </div>
    </div>
  );
  return (
    <>
      <Link href="#content" className="skip-link">
        {t("skip")}
      </Link>
      <div className="app-layout">
        <AppNavigation role={user.role} footer={identity} />
        <div className="app-body">
          <header className="session-header">
            <MobileNavigation role={user.role} footer={identity} />
            <WorkspacePath role={user.role} />
            <div className="session-actions">
              <details className="user-preferences">
                <summary className="text-link">{t("preferences")}</summary>
                <ThemeControls />
                <PwaInstall />
                {user.role !== "brand" && (
                  <PushSettings
                    publicKey={
                      process.env.NODE_ENV === "production"
                        ? (pushConfig()?.publicKey ?? null)
                        : null
                    }
                  />
                )}
              </details>
              <LogoutForm />
            </div>
          </header>
          <main id="content" tabIndex={-1} className="page-container stack">
            <PwaStatus />
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

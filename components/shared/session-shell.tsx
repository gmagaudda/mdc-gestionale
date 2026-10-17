import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppNavigation, MobileNavigation } from "./app-navigation";
import { PwaStatus } from "@/components/pwa/pwa-status";
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
  const publicKey =
    process.env.NODE_ENV === "production"
      ? (pushConfig()?.publicKey ?? null)
      : null;
  return (
    <>
      <Link href="#content" className="skip-link">
        {t("skip")}
      </Link>
      <AppNavigation user={user} publicKey={publicKey}>
        <main id="content" tabIndex={-1} className="page-container stack">
          <MobileNavigation user={user} publicKey={publicKey} />
          <PwaStatus />
          {children}
        </main>
      </AppNavigation>
    </>
  );
}

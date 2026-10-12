"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { ResponsiveDialog } from "./responsive-dialog";
import { homeForRole, type Role } from "@/lib/auth/roles";
export function AppNavigation({ role }: { role: Role }) {
  const t = useTranslations("common");
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    { href: homeForRole(role), label: t("dashboard") },
    ...(role !== "brand"
      ? [
          { href: "/brands", label: t("brands") },
          { href: "/customers", label: t("customers") },
          { href: "/seasons", label: t("seasons") },
          { href: "/products", label: t("products") },
          { href: "/orders", label: t("orders") },
          { href: "/calendar", label: t("calendar") },
          { href: "/documents", label: t("documents") },
          { href: "/budgets", label: t("budgets") },
          { href: "/commissions", label: t("commissions") },
        ]
      : [
          { href: "/portal/orders", label: t("orders") },
          { href: "/portal/sales", label: t("sales") },
          { href: "/portal/documents", label: t("documents") },
          { href: "/portal/calendar", label: t("calendar") },
        ]),
    ...(role === "admin"
      ? [
          { href: "/settings/users", label: t("users") },
          { href: "/settings/audit", label: t("audit") },
        ]
      : []),
  ];
  const navigation = (mobile = false) => (
    <nav
      className="app-navigation"
      aria-label={t(role === "brand" ? "portalName" : "appName")}
    >
      {links.map((link) => (
        <Link
          className="navigation-link"
          key={link.href}
          href={link.href}
          aria-current={
            path === link.href || path.startsWith(`${link.href}/`)
              ? "page"
              : undefined
          }
          onClick={() => {
            if (mobile) setOpen(false);
          }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
  return (
    <>
      <aside className="app-sidebar">
        <p>{t(role === "brand" ? "portalName" : "appName")}</p>
        {navigation()}
      </aside>
      <div className="mobile-navigation">
        <ResponsiveDialog
          open={open}
          onOpenChange={setOpen}
          title={t("menu")}
          trigger={
            <Button variant="secondary" size="lg">
              {t("menu")}
            </Button>
          }
        >
          {navigation(true)}
        </ResponsiveDialog>
      </div>
    </>
  );
}

"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { Breadcrumb } from "@/components/arc/breadcrumb/breadcrumb";
import { ResponsiveDialog } from "./responsive-dialog";
import { ErpIcon } from "./erp-icon";
import type { Role } from "@/lib/auth/roles";
import {
  isNavigationActive,
  navigationForRole,
  type NavigationLink,
  type NavigationGroup as Group,
} from "@/lib/navigation";

function NavigationGroup({
  group,
  path,
  onNavigate,
}: {
  group: Group;
  path: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("common");
  const active = group.links.some((link) =>
    isNavigationActive(path, link.href),
  );
  // Expand newly entered areas, keeping the areas opened by the user.
  const [lastActive, setLastActive] = useState(active);
  const [expanded, setExpanded] = useState(active || group.id === "commercial");
  if (active !== lastActive) {
    setLastActive(active);
    if (active) setExpanded(true);
  }
  return (
    <li>
      <details
        className="navigation-group"
        open={expanded}
        onToggle={(event) => setExpanded(event.currentTarget.open)}
      >
        <summary
          className="navigation-link navigation-group-trigger"
          data-active={active || undefined}
        >
          <ErpIcon name={group.icon} />
          <span>{t(group.label)}</span>
          <ErpIcon name="chevron" className="navigation-chevron" />
        </summary>
        <ul className="navigation-submenu">
          {group.links.map((link) => (
            <li key={link.href}>
              <NavigationItem link={link} path={path} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function NavigationItem({
  link,
  path,
  onNavigate,
}: {
  link: NavigationLink;
  path: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("common");
  return (
    <Link
      className="navigation-link"
      href={link.href}
      aria-current={isNavigationActive(path, link.href) ? "page" : undefined}
      onClick={onNavigate}
    >
      <ErpIcon name={link.icon} />
      <span>{t(link.label)}</span>
    </Link>
  );
}

function Navigation({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const t = useTranslations("common");
  const path = usePathname();
  const { home, groups, standalone } = navigationForRole(role);
  return (
    <nav
      className="app-navigation"
      aria-label={t(role === "brand" ? "portalName" : "appName")}
    >
      <ul className="navigation-list">
        <li>
          <NavigationItem link={home} path={path} onNavigate={onNavigate} />
        </li>
        {groups
          .filter((group) => group.id !== "settings")
          .map((group) => (
            <NavigationGroup
              key={group.id}
              group={group}
              path={path}
              onNavigate={onNavigate}
            />
          ))}
        {standalone.map((link) => (
          <li key={link.href}>
            <NavigationItem link={link} path={path} onNavigate={onNavigate} />
          </li>
        ))}
        {groups
          .filter((group) => group.id === "settings")
          .map((group) => (
            <NavigationGroup
              key={group.id}
              group={group}
              path={path}
              onNavigate={onNavigate}
            />
          ))}
      </ul>
    </nav>
  );
}

export function AppNavigation({
  role,
  footer,
}: {
  role: Role;
  footer: ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <aside className="app-sidebar">
      <Link
        href={navigationForRole(role).home.href}
        className="sidebar-brand"
        aria-label={t("appName")}
      >
        <span className="sidebar-wordmark">{t("brandMark")}</span>
        <span>{t(role === "brand" ? "portalName" : "workspaceName")}</span>
      </Link>
      <Navigation role={role} />
      <div className="sidebar-account">{footer}</div>
    </aside>
  );
}

export function MobileNavigation({
  role,
  footer,
}: {
  role: Role;
  footer: ReactNode;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  return (
    <div className="mobile-navigation">
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title={t("menu")}
        trigger={
          <Button variant="secondary" size="lg">
            <ErpIcon name="menu" />
            {t("menu")}
          </Button>
        }
      >
        <Navigation role={role} onNavigate={() => setOpen(false)} />
        <div className="sidebar-account">{footer}</div>
      </ResponsiveDialog>
    </div>
  );
}

export function WorkspacePath({ role }: { role: Role }) {
  const t = useTranslations("common");
  const path = usePathname();
  const { home, groups, standalone } = navigationForRole(role);
  const group = groups.find((group) =>
    group.links.some((link) => isNavigationActive(path, link.href)),
  );
  const current = [
    home,
    ...standalone,
    ...groups.flatMap((group) => group.links),
  ].find((link) => isNavigationActive(path, link.href));
  return (
    <div className="workspace-path">
      <div className="workspace-path-full">
        <Breadcrumb
          ariaLabel={t("pageLocation")}
          items={[
            { label: t(role === "brand" ? "portalName" : "workspaceName") },
            ...(group ? [{ label: t(group.label) }] : []),
            { label: current ? t(current.label) : t("recordDetail") },
          ]}
        />
      </div>
      <span className="workspace-path-compact" aria-current="page">
        {current ? t(current.label) : t("recordDetail")}
      </span>
    </div>
  );
}

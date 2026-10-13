"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/arc/button/button";
import { SearchField } from "@/components/arc/search-field/search-field";
import { AccountMenu, type AccountUser } from "./account-menu";
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
  searching = false,
}: {
  searching?: boolean;
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
        open={searching || expanded}
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
  collapsed = false,
}: {
  link: NavigationLink;
  path: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const t = useTranslations("common");
  return (
    <Link
      className="navigation-link"
      href={link.href}
      aria-label={collapsed ? t(link.label) : undefined}
      title={t(link.label)}
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
  query = "",
  collapsed = false,
}: {
  role: Role;
  onNavigate?: () => void;
  query?: string;
  collapsed?: boolean;
}) {
  const t = useTranslations("common");
  const path = usePathname();
  const menu = navigationForRole(role);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("it")
      .trim();
  const term = normalize(query);
  const matches = (label: string) => normalize(t(label)).includes(term);
  const groups = menu.groups
    .map((group) => ({
      ...group,
      links: group.links.filter(
        (link) => matches(group.label) || matches(link.label),
      ),
    }))
    .filter((group) => group.links.length);
  const standalone = menu.standalone.filter((link) => matches(link.label));
  const links = [
    ...(matches(menu.home.label) ? [menu.home] : []),
    ...groups
      .filter((group) => group.id !== "settings")
      .flatMap((group) => group.links),
    ...standalone,
    ...groups
      .filter((group) => group.id === "settings")
      .flatMap((group) => group.links),
  ];
  const renderGroup = (group: Group) => (
    <NavigationGroup
      key={group.id}
      group={group}
      path={path}
      onNavigate={onNavigate}
      searching={Boolean(term)}
    />
  );
  return (
    <nav
      className="app-navigation"
      aria-label={t(role === "brand" ? "portalName" : "appName")}
    >
      {term && (
        <p className="sr-only" role="status">
          {t("sidebarSearchCount", { count: links.length })}
        </p>
      )}
      {!links.length ? (
        <p>{t("sidebarSearchEmpty")}</p>
      ) : (
        <ul className="navigation-list">
          {collapsed ? (
            links.map((link) => (
              <li key={link.href}>
                <NavigationItem
                  collapsed
                  link={link}
                  path={path}
                  onNavigate={onNavigate}
                />
              </li>
            ))
          ) : (
            <>
              {matches(menu.home.label) && (
                <li>
                  <NavigationItem
                    link={menu.home}
                    path={path}
                    onNavigate={onNavigate}
                  />
                </li>
              )}
              {groups
                .filter((group) => group.id !== "settings")
                .map(renderGroup)}
              {standalone.map((link) => (
                <li key={link.href}>
                  <NavigationItem
                    link={link}
                    path={path}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
              {groups
                .filter((group) => group.id === "settings")
                .map(renderGroup)}
            </>
          )}
        </ul>
      )}
    </nav>
  );
}

function NavigationSearch({
  query,
  onChange,
  autoFocus = false,
}: {
  query: string;
  onChange: (query: string) => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations("common");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const localize = () =>
      element
        .querySelector('button[aria-label="Clear search"]')
        ?.setAttribute("aria-label", t("sidebarSearchClear"));
    localize();
    const observer = new MutationObserver(localize);
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [t]);
  return (
    <div ref={root} className="sidebar-search">
      <SearchField
        label={t("sidebarSearch")}
        value={query}
        onValueChange={onChange}
        maxLength={100}
        autoFocus={autoFocus}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onChange("");
          }
        }}
      />
    </div>
  );
}

export function AppNavigation({
  user,
  publicKey,
}: {
  user: AccountUser;
  publicKey: string | null;
}) {
  const role = user.role;
  const t = useTranslations("common");
  const [collapsed, setCollapsed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const searchButton = useRef<HTMLButtonElement>(null);
  return (
    <aside className="app-sidebar" data-collapsed={collapsed || undefined}>
      <div className="sidebar-heading">
        <Link
          href={navigationForRole(role).home.href}
          className="sidebar-brand"
          aria-label={t("appName")}
        >
          <span className="sidebar-wordmark">{t("brandMark")}</span>
          <span className="sidebar-workspace-name">
            {t(role === "brand" ? "portalName" : "workspaceName")}
          </span>
        </Link>
        <div className="sidebar-tools">
          <Button
            variant="ghost"
            aria-label={t(collapsed ? "sidebarExpand" : "sidebarCollapse")}
            title={t(collapsed ? "sidebarExpand" : "sidebarCollapse")}
            aria-expanded={!collapsed}
            onClick={() => {
              setCollapsed(!collapsed);
              setSearching(false);
              setQuery("");
            }}
          >
            <ErpIcon name={collapsed ? "sidebarExpand" : "sidebarCollapse"} />
          </Button>
          <Button
            ref={searchButton}
            variant="ghost"
            aria-label={t(
              searching ? "sidebarSearchClose" : "sidebarSearchToggle",
            )}
            title={t("sidebarSearchToggle")}
            aria-expanded={searching}
            onClick={() => {
              setCollapsed(false);
              setSearching(!searching);
              setQuery("");
            }}
          >
            <ErpIcon name="search" />
          </Button>
        </div>
      </div>
      {searching && (
        <div
          onKeyDown={(event) => {
            if (event.key === "Escape" && !query) {
              setSearching(false);
              searchButton.current?.focus();
            }
          }}
        >
          <NavigationSearch query={query} onChange={setQuery} autoFocus />
        </div>
      )}
      <Navigation role={role} query={query} collapsed={collapsed} />
      <div className="sidebar-account">
        <AccountMenu user={user} publicKey={publicKey} collapsed={collapsed} />
      </div>
    </aside>
  );
}

export function MobileNavigation({
  user,
  publicKey,
}: {
  user: AccountUser;
  publicKey: string | null;
}) {
  const role = user.role;
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [accountActive, setAccountActive] = useState(false);
  return (
    <div className="mobile-navigation">
      <ResponsiveDialog
        modal={false}
        className="navigation-dialog"
        open={open}
        onInteractOutside={(event) => {
          if (accountActive) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (accountActive) {
            event.preventDefault();
            return;
          }
          if (query) {
            event.preventDefault();
            setQuery("");
          }
        }}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        title={t("menu")}
        trigger={
          <Button variant="secondary" size="lg">
            <ErpIcon name="menu" />
            {t("menu")}
          </Button>
        }
      >
        <NavigationSearch query={query} onChange={setQuery} />
        <Navigation
          role={role}
          query={query}
          onNavigate={() => {
            setOpen(false);
            setQuery("");
          }}
        />
        <div className="sidebar-account">
          <AccountMenu
            user={user}
            publicKey={publicKey}
            onSurfaceChange={setAccountActive}
          />
        </div>
      </ResponsiveDialog>
    </div>
  );
}

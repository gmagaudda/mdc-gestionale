"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
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

const panelTransition = motionTokens.spring.smooth;
const fadeTransition = { duration: motionTokens.duration.fast };

function NavigationLabel({
  children,
  collapsed,
}: {
  children: ReactNode;
  collapsed: boolean;
}) {
  const reduce = useReducedMotion() !== false;
  return (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.span
          className="navigation-label"
          initial={{ opacity: 0, x: reduce ? 0 : -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduce ? 0 : -6 }}
          transition={fadeTransition}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function NavigationSubmenu({
  children,
  id,
  collapsed,
  instant,
}: {
  children: ReactNode;
  id: string;
  collapsed: boolean;
  instant: boolean;
}) {
  const present = useIsPresent();
  const reduce = useReducedMotion() !== false;
  return (
    <motion.ul
      id={id}
      className="navigation-submenu"
      inert={!present}
      aria-hidden={!present || undefined}
      initial="closed"
      animate="open"
      exit="closed"
      variants={{
        closed: {
          opacity: 0,
          transition: { ...fadeTransition, staggerChildren: 0 },
        },
        open: {
          opacity: 1,
          transition: {
            ...fadeTransition,
            staggerChildren:
              reduce || instant || collapsed ? 0 : motionTokens.stagger.item,
          },
        },
      }}
      transition={instant ? { duration: 0 } : fadeTransition}
    >
      {children}
    </motion.ul>
  );
}

function NavigationGroup({
  group,
  path,
  onNavigate,
  searching = false,
  collapsed = false,
}: {
  searching?: boolean;
  collapsed?: boolean;
  group: Group;
  path: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("common");
  const id = useId();
  const reduce = useReducedMotion() !== false;
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
  const open = searching || expanded || collapsed;
  return (
    <motion.li
      layout="position"
      transition={searching ? { duration: 0 } : panelTransition}
    >
      <div className="navigation-group">
        <motion.div
          layout="position"
          transition={panelTransition}
          hidden={collapsed}
        >
          <Button
            variant="ghost"
            className="navigation-link navigation-group-trigger"
            data-active={active || undefined}
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            <ErpIcon name={group.icon} />
            <span>{t(group.label)}</span>
            <motion.span
              className="navigation-chevron"
              initial={false}
              animate={{ rotate: open ? 180 : 0 }}
              transition={reduce ? { duration: 0 } : panelTransition}
            >
              <ErpIcon name="chevron" />
            </motion.span>
          </Button>
        </motion.div>
        <AnimatePresence initial={false}>
          {open && (
            <NavigationSubmenu
              id={id}
              collapsed={collapsed}
              instant={searching}
            >
              {group.links.map((link) => (
                <motion.li
                  key={link.href}
                  layout="position"
                  variants={{
                    closed: { opacity: 0, y: reduce || searching ? 0 : -6 },
                    open: { opacity: 1, y: 0 },
                  }}
                  transition={searching ? { duration: 0 } : fadeTransition}
                >
                  <NavigationItem
                    link={link}
                    path={path}
                    onNavigate={onNavigate}
                    collapsed={collapsed}
                  />
                </motion.li>
              ))}
            </NavigationSubmenu>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
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
      aria-label={t(link.label)}
      title={t(link.label)}
      aria-current={isNavigationActive(path, link.href) ? "page" : undefined}
      onClick={onNavigate}
    >
      {isNavigationActive(path, link.href) && (
        <motion.span
          className="navigation-active"
          layoutId="navigation-active"
          transition={motionTokens.spring.morph}
          aria-hidden="true"
        />
      )}
      <motion.span
        className="navigation-icon"
        layout="position"
        transition={panelTransition}
      >
        <ErpIcon name={link.icon} />
      </motion.span>
      <NavigationLabel collapsed={collapsed}>{t(link.label)}</NavigationLabel>
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
  const navigationId = useId();
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
      collapsed={collapsed}
    />
  );
  return (
    <LayoutGroup id={navigationId}>
      <motion.nav
        layout="position"
        layoutScroll
        transition={term ? { duration: 0 } : panelTransition}
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
            <>
              {matches(menu.home.label) && (
                <motion.li layout="position" transition={panelTransition}>
                  <NavigationItem
                    link={menu.home}
                    path={path}
                    onNavigate={onNavigate}
                    collapsed={collapsed}
                  />
                </motion.li>
              )}
              {groups
                .filter((group) => group.id !== "settings")
                .map(renderGroup)}
              {standalone.map((link) => (
                <motion.li
                  key={link.href}
                  layout="position"
                  transition={panelTransition}
                >
                  <NavigationItem
                    link={link}
                    path={path}
                    onNavigate={onNavigate}
                    collapsed={collapsed}
                  />
                </motion.li>
              ))}
              {groups
                .filter((group) => group.id === "settings")
                .map(renderGroup)}
            </>
          </ul>
        )}
      </motion.nav>
    </LayoutGroup>
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
  children,
}: {
  user: AccountUser;
  publicKey: string | null;
  children: ReactNode;
}) {
  const role = user.role;
  const t = useTranslations("common");
  const [collapsed, setCollapsed] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const searchButton = useRef<HTMLButtonElement>(null);
  return (
    <MotionConfig reducedMotion="user" transition={panelTransition}>
      <LayoutGroup>
        <div className="app-layout">
          <motion.aside
            layout
            initial={false}
            className="app-sidebar"
            data-collapsed={collapsed || undefined}
          >
            <motion.div layout="position" className="sidebar-heading">
              <Link
                href={navigationForRole(role).home.href}
                className="sidebar-brand"
                aria-label={t("appName")}
              >
                <span className="sidebar-wordmark">{t("brandMark")}</span>
              </Link>
              <motion.div layout="position" className="sidebar-tools">
                <motion.div layout="position">
                  <Button
                    variant="ghost"
                    aria-label={t(
                      collapsed ? "sidebarExpand" : "sidebarCollapse",
                    )}
                    title={t(collapsed ? "sidebarExpand" : "sidebarCollapse")}
                    aria-expanded={!collapsed}
                    onClick={() => {
                      setCollapsed(!collapsed);
                      setSearching(false);
                      setQuery("");
                    }}
                  >
                    <ErpIcon
                      name={collapsed ? "sidebarExpand" : "sidebarCollapse"}
                    />
                  </Button>
                </motion.div>
                <motion.div layout="position">
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
                </motion.div>
              </motion.div>
            </motion.div>
            {searching && (
              <motion.div
                key="sidebar-search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fadeTransition}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !query) {
                    setSearching(false);
                    searchButton.current?.focus();
                  }
                }}
              >
                <NavigationSearch query={query} onChange={setQuery} autoFocus />
              </motion.div>
            )}
            <Navigation role={role} query={query} collapsed={collapsed} />
            <motion.div layout="position" className="sidebar-account">
              <AccountMenu
                user={user}
                publicKey={publicKey}
                collapsed={collapsed}
              />
            </motion.div>
          </motion.aside>
          <motion.div layout="position" className="app-body">
            {children}
          </motion.div>
        </div>
      </LayoutGroup>
    </MotionConfig>
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
          if (
            accountActive ||
            (event.target instanceof HTMLElement &&
              event.target.closest('[role="menu"], .accent-popover'))
          ) {
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

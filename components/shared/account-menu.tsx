"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import { Alert } from "@/components/arc/alert/alert";
import { PwaInstall } from "@/components/pwa/pwa-status";
import { usePushToggle } from "@/components/pwa/use-push-toggle";
import { useTheme } from "next-themes";
import { IconMorph } from "@/components/arc/icon-morph/icon-morph";
import {
  Popover,
  PopoverContent,
  PopoverClose,
} from "@/components/arc/popover/popover";
import { PopoverAnchor } from "@radix-ui/react-popover";
import { Button } from "@/components/arc/button/button";
import { accents } from "@/lib/theme/accents";
import { useAccent } from "@/lib/theme/use-accent";
import { logoutSession } from "@/components/pwa/logout-form";
import type { Role } from "@/lib/auth/roles";
import { ResponsiveDialog } from "./responsive-dialog";
import { ErpIcon } from "./erp-icon";

export type AccountUser = { role: Role; full_name: string; email: string };

export function AccountMenu({
  user,
  publicKey,
  collapsed = false,
  onSurfaceChange,
}: {
  user: AccountUser;
  collapsed?: boolean;
  onSurfaceChange?: (active: boolean) => void;
  publicKey: string | null;
}) {
  const t = useTranslations("common");
  const pwa = useTranslations("pwa");
  const push = useTranslations("push");
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [accentOpen, setAccentOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const { accent, setAccent } = useAccent();
  const notifications = usePushToggle(publicKey, open && user.role !== "brand");
  const [error, setError] = useState(false);
  const name = user.full_name || user.email;

  useEffect(() => {
    onSurfaceChange?.(open || installOpen || accentOpen);
  }, [open, installOpen, accentOpen, onSurfaceChange]);

  // Arc has fixed English labels. Localize this instance's portal without
  // modifying vendor source or styling its internals.
  useEffect(() => {
    const localize = () => {
      const button = trigger.current;
      button?.setAttribute("aria-label", t("userMenu", { name }));
      button?.setAttribute("title", name);
      const menuId = button?.getAttribute("aria-controls");
      const menu = menuId ? document.getElementById(menuId) : null;
      // aria-modal is valid on a dialog, not on Arc's mobile role="menu".
      menu?.removeAttribute("aria-modal");
      // UserMenu exposes action items only. Add toggle semantics to this
      // instance, keeping the vendor keyboard navigation and stable labels.
      for (const row of menu?.querySelectorAll<HTMLElement>(
        '[data-stop="item"]',
      ) ?? []) {
        const label = row.dataset.label;
        if (label !== t("theme") && label !== push("menuLabel")) continue;
        const theme = label === t("theme");
        row.setAttribute("role", "menuitemcheckbox");
        row.setAttribute(
          "aria-checked",
          String(theme ? dark : notifications.active),
        );
        row.setAttribute(
          "aria-disabled",
          String(
            !theme &&
              Boolean(notifications.unavailable) &&
              notifications.unavailable !== "saveError",
          ),
        );
        row.setAttribute(
          "aria-description",
          theme
            ? t(dark ? "dark" : "light")
            : notifications.unavailable
              ? push(notifications.unavailable)
              : push(notifications.active ? "active" : "inactive"),
        );
        row.setAttribute(
          "title",
          theme
            ? t(dark ? "light" : "dark")
            : notifications.unavailable
              ? push(notifications.unavailable)
              : push(notifications.active ? "revoke" : "enable"),
        );
      }
      const signOut = menu?.querySelector(
        '[data-tone="danger"][role="menuitem"]',
      );
      if (!signOut) return;
      signOut.setAttribute("data-label", t("logout"));
      const walker = document.createTreeWalker(signOut, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.textContent === "Sign out") node.textContent = t("logout");
        else if (node.textContent === "Signing out")
          node.textContent = t("signingOut");
      }
    };
    localize();
    if (!open) return;
    const observer = new MutationObserver(localize);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [
    name,
    open,
    t,
    push,
    dark,
    notifications.active,
    notifications.unavailable,
  ]);

  function retainMenu(label: string) {
    setOpen(true);
    requestAnimationFrame(() => {
      const menuId = trigger.current?.getAttribute("aria-controls");
      const menu = menuId ? document.getElementById(menuId) : null;
      Array.from(menu?.querySelectorAll<HTMLElement>("[data-stop]") ?? [])
        .find((row) => row.dataset.label === label)
        ?.focus();
    });
  }

  async function signOut() {
    setError(false);
    try {
      const result = await logoutSession();
      if (!result.ok) {
        setError(true);
        requestAnimationFrame(() => trigger.current?.focus());
      }
    } catch {
      setError(true);
      requestAnimationFrame(() => trigger.current?.focus());
    }
  }

  return (
    <div className="stack">
      <Popover modal open={accentOpen} onOpenChange={setAccentOpen}>
        <PopoverAnchor asChild>
          <div>
            <UserMenu
              ref={trigger}
              className="account-menu-trigger"
              user={{ name, email: user.email }}
              showName={!collapsed}
              align="start"
              showTheme={false}
              open={open}
              onOpenChange={setOpen}
              onSignOut={signOut}
              items={[
                {
                  label: t("theme"),
                  icon: <IconMorph name="theme" state={dark} size={18} />,
                  onSelect: () => {
                    setTheme(dark ? "light" : "dark");
                    retainMenu(t("theme"));
                  },
                },
                {
                  label: t("accent"),
                  icon: <ErpIcon name="settings" />,
                  onSelect: () => setAccentOpen(true),
                },
                {
                  label: pwa("install"),
                  icon: <ErpIcon name="download" />,
                  onSelect: () => setInstallOpen(true),
                },
                ...(user.role === "brand"
                  ? []
                  : [
                      {
                        label: push("menuLabel"),
                        icon: (
                          <IconMorph
                            name="bell"
                            state={notifications.active}
                            size={18}
                          />
                        ),
                        onSelect: () => {
                          if (
                            notifications.error &&
                            (!notifications.unavailable ||
                              notifications.unavailable === "saveError")
                          )
                            notifications.retry();
                          else void notifications.toggle();
                          retainMenu(push("menuLabel"));
                        },
                      },
                    ]),
              ]}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="start"
          aria-label={t("accent")}
          className="accent-popover"
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            setAccentOpen(false);
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() =>
              document
                .querySelector<HTMLInputElement>(
                  ".accent-popover input:checked",
                )
                ?.focus(),
            );
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <div className="accent-heading">
            <span>{t("accent")}</span>
            <PopoverClose asChild>
              <Button variant="ghost" aria-label={t("close")}>
                {t("close")}
              </Button>
            </PopoverClose>
          </div>
          <fieldset className="accent-options">
            <legend className="sr-only">{t("accent")}</legend>
            {accents.map((value) => (
              <label key={value} className="accent-choice" data-value={value}>
                <input
                  type="radio"
                  name="accent"
                  value={value}
                  checked={accent === value}
                  onChange={() => setAccent(value)}
                />
                <span className="accent-swatch" aria-hidden="true" />
                {t(`accents.${value}`)}
              </label>
            ))}
          </fieldset>
        </PopoverContent>
      </Popover>
      {user.role !== "brand" &&
        (notifications.success === "revoked" ||
          notifications.error ||
          (open && notifications.unavailable)) && (
          <div
            className="account-menu-feedback"
            role="status"
            aria-live="polite"
          >
            {notifications.error ? (
              <Alert tone="danger" title={push("errorTitle")}>
                {push("saveError")}
              </Alert>
            ) : (
              <p>
                {notifications.pending
                  ? push("loading")
                  : notifications.success === "revoked"
                    ? push("revoked")
                    : notifications.unavailable
                      ? push(notifications.unavailable)
                      : push(notifications.active ? "active" : "inactive")}
              </p>
            )}
          </div>
        )}
      {error && (
        <div className="account-menu-error">
          <Alert tone="danger" title={t("logoutError")} />
        </div>
      )}
      <ResponsiveDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        title={pwa("install")}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        <PwaInstall onInstall={() => setInstallOpen(false)} />
      </ResponsiveDialog>
    </div>
  );
}

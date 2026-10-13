"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import { Alert } from "@/components/arc/alert/alert";
import { PwaInstall } from "@/components/pwa/pwa-status";
import { PushSettings } from "@/components/pwa/push-settings";
import { logoutSession } from "@/components/pwa/logout-form";
import type { Role } from "@/lib/auth/roles";
import { ThemeControls } from "./theme-controls";
import { ResponsiveDialog } from "./responsive-dialog";
import { ErpIcon } from "./erp-icon";

export function AccountMenu({
  user,
  publicKey,
}: {
  user: { role: Role; full_name: string; email: string };
  publicKey: string | null;
}) {
  const t = useTranslations("common");
  const pwa = useTranslations("pwa");
  const push = useTranslations("push");
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<
    "theme" | "install" | "notifications" | null
  >(null);
  const [error, setError] = useState(false);
  const name = user.full_name || user.email;

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
  }, [name, open, t]);

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
      <UserMenu
        ref={trigger}
        className="account-menu-trigger"
        user={{ name, email: user.email }}
        showName
        showTheme={false}
        open={open}
        onOpenChange={setOpen}
        onSignOut={signOut}
        items={[
          {
            label: t("theme"),
            icon: <ErpIcon name="settings" />,
            onSelect: () => setPanel("theme"),
          },
          {
            label: pwa("install"),
            icon: <ErpIcon name="download" />,
            onSelect: () => setPanel("install"),
          },
          ...(user.role === "brand"
            ? []
            : [
                {
                  label: push("menuLabel"),
                  icon: <ErpIcon name="calendar" />,
                  onSelect: () => setPanel("notifications"),
                },
              ]),
        ]}
      />
      {error && (
        <div className="account-menu-error">
          <Alert tone="danger" title={t("logoutError")} />
        </div>
      )}
      <ResponsiveDialog
        open={panel !== null}
        onOpenChange={(value) => {
          if (!value) setPanel(null);
        }}
        title={
          panel === "theme"
            ? t("theme")
            : panel === "install"
              ? pwa("install")
              : push("menuLabel")
        }
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        {panel === "theme" && <ThemeControls />}
        {panel === "install" && <PwaInstall onInstall={() => setPanel(null)} />}
        {panel === "notifications" && user.role !== "brand" && (
          <PushSettings publicKey={publicKey} />
        )}
      </ResponsiveDialog>
    </div>
  );
}

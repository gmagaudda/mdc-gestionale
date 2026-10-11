"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { ThemeSwitch } from "@/components/arc/theme-switch/theme-switch";

const subscribe = () => () => {};
export function ThemeControls() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const { theme, resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("common");
  return (
    <div className="theme-controls" aria-label={t("theme")}>
      <SegmentedControl
        label={t("theme")}
        value={mounted ? (theme ?? "system") : "system"}
        onValueChange={setTheme}
        options={[
          { value: "system", label: t("system") },
          { value: "light", label: t("light") },
          { value: "dark", label: t("dark") },
        ]}
      />
      <span className="theme-toggle">
        <ThemeSwitch
          iconOnly
          theme={mounted && resolvedTheme === "dark" ? "dark" : "light"}
          label={t("toggleTheme")}
          onThemeChange={setTheme}
        />
      </span>
    </div>
  );
}

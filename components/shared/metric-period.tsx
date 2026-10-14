"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { SplitButton } from "@/components/arc/split-button/split-button";
import { Button } from "@/components/arc/button/button";
import { ErpIcon } from "./erp-icon";

const query = "(pointer: coarse), (max-width: 390px)";
const subscribe = (notify: () => void) => {
  const media = matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
// The registry SplitButton's chevron is 32 px with no size/className prop.
// Use Arc buttons for the same control on touch, retaining 44 px targets.
export function MetricPeriod({
  label,
  days,
  onChange,
}: {
  label: string;
  days: 7 | 30 | 90;
  onChange: (days: 7 | 30 | 90) => void;
}) {
  const t = useTranslations("tableMetrics");
  const root = useRef<HTMLDivElement>(null);
  const compact = useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
  const options = [7, 30, 90] as const;
  const toggleLabel = t("choosePeriod", { label });
  // Localize the registry's fixed English trigger label through this wrapper.
  useEffect(() => {
    root.current
      ?.querySelector('button[aria-haspopup="menu"]')
      ?.setAttribute("aria-label", toggleLabel);
  }, [toggleLabel, days, compact]);
  const open = () =>
    root.current
      ?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')
      ?.click();
  return (
    <div
      ref={root}
      className="metric-period-control"
      role="group"
      aria-label={t("periodFor", { label })}
    >
      {compact ? (
        <Menu.Root>
          <div className="metric-split-touch">
            <Button variant="secondary" onClick={open}>
              {t("days", { days })}
            </Button>
            <Menu.Trigger asChild>
              <Button variant="secondary" aria-label={toggleLabel}>
                <ErpIcon name="chevron" />
              </Button>
            </Menu.Trigger>
          </div>
          <Menu.Portal>
            <Menu.Content
              className="metric-period-menu"
              align="start"
              sideOffset={6}
              collisionPadding={12}
              loop
            >
              {options.map((value) => (
                <Menu.Item
                  key={value}
                  className="metric-period-option"
                  onSelect={() => onChange(value)}
                >
                  {t("days", { days: value })}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      ) : (
        <SplitButton
          variant="secondary"
          label={t("days", { days })}
          onClick={open}
          actions={options.map((value) => ({
            label: t("days", { days: value }),
            onSelect: () => onChange(value),
          }))}
        />
      )}
    </div>
  );
}

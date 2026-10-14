"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/arc/tabs/tabs";

export function ProductBrandTabs({
  brands,
  selected,
  children,
}: {
  brands: { id: string; name: string }[];
  selected?: string;
  children: ReactNode;
}) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  // Localize the scroll actions supplied by Arc without changing its source.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const localize = () => {
      for (const [source, key] of [
        ["Scroll tabs left", "previousBrands"],
        ["Scroll tabs right", "nextBrands"],
      ] as const) {
        element
          .querySelector(`button[aria-label="${source}"]`)
          ?.setAttribute("aria-label", t(key));
      }
    };
    localize();
    const observer = new MutationObserver(localize);
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [t]);
  const options = [{ id: "all", name: t("allBrands") }, ...brands];
  return (
    <div ref={root} className="product-brand-header" aria-busy={pending}>
      <Tabs
        value={selected || "all"}
        activationMode="manual"
        onValueChange={(value) => {
          const next = new URLSearchParams(params.toString());
          next.delete("page");
          if (value === "all") next.delete("brand_id");
          else next.set("brand_id", value);
          start(() => router.push(`/products?${next}`, { scroll: false }));
        }}
      >
        <TabsList aria-label={t("productBrands")}>
          {options.map((brand) => (
            <TabsTrigger key={brand.id} value={brand.id} title={brand.name}>
              <span className="product-brand-label">{brand.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <p className="product-brand-selection" role="status">
          {t("selectedBrand", {
            name:
              options.find((brand) => brand.id === (selected || "all"))?.name ??
              t("allBrands"),
          })}
        </p>
        {options.map((brand) => (
          <TabsContent key={brand.id} value={brand.id}>
            {brand.id === (selected || "all") ? children : null}
          </TabsContent>
        ))}
      </Tabs>
      <span className="sr-only" role="status">
        {pending ? t("loadingBrandProducts") : ""}
      </span>
    </div>
  );
}

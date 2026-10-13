import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Better Icons 1.0.4 adds child fills even inside stroke-only groups.
// Request fill none so the Tabler outline paths inherit their original stroke.
const icons = {
  dashboard: "layout-dashboard",
  commercial: "briefcase",
  catalog: "category",
  finance: "wallet",
  insights: "chart-bar",
  settings: "settings",
  orders: "shopping-bag",
  customers: "users",
  brands: "tag",
  seasons: "sun",
  products: "hanger",
  invoices: "receipt",
  calendar: "calendar-event",
  documents: "files",
  budgets: "target",
  commissions: "percentage",
  analysis: "chart-pie",
  imports: "file-import",
  audit: "history",
  sales: "trending-up",
  menu: "menu-2",
  chevron: "chevron-down",
  sidebarCollapse: "layout-sidebar-left-collapse",
  sidebarExpand: "layout-sidebar-left-expand",
  search: "search",
  plus: "plus",
  download: "download",
};
const attrs = {
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-width": "strokeWidth",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
};
let source =
  "// Tabler outline SVGs retrieved with Better Icons 1.0.4. See docs/UI-ICONS.md.\n";
source += "const shapes = {\n";
for (const [key, id] of Object.entries(icons)) {
  const result = JSON.parse(
    execFileSync(
      "pnpm",
      [
        "dlx",
        "better-icons@1.0.4",
        "get",
        `tabler:${id}`,
        "--color",
        "none",
        "--size",
        "24",
        "--json",
      ],
      { encoding: "utf8" },
    ),
  );
  if (!result.svg) throw Error(`Missing icon ${id}`);
  let body = result.svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  for (const [from, to] of Object.entries(attrs))
    body = body.replaceAll(from, to);
  source += `  ${key}: <>${body}</>,\n`;
}
source += "} as const;\nexport type ErpIconName = keyof typeof shapes;\n";
source +=
  'export function ErpIcon({ name, className }: { name: ErpIconName; className?: string }) {\n return <svg className={className} width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{shapes[name]}</svg>;\n}\n';
writeFileSync(
  fileURLToPath(new URL("../components/shared/erp-icon.tsx", import.meta.url)),
  source,
);
console.log(`Retrieved ${Object.keys(icons).length} Better Icons SVGs`);

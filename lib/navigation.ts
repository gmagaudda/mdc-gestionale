import { homeForRole, type Role } from "./auth/roles";
import type { ErpIconName } from "@/components/shared/erp-icon";

export type NavigationLink = { href: string; label: string; icon: ErpIconName };
export type NavigationGroup = {
  id: string;
  label: string;
  icon: ErpIconName;
  links: NavigationLink[];
};

// Visibility matches the existing menu. Route guards and RLS remain authoritative.
export function navigationForRole(role: Role): {
  home: NavigationLink;
  groups: NavigationGroup[];
  standalone: NavigationLink[];
} {
  const home: NavigationLink = {
    href: homeForRole(role),
    label: "dashboard",
    icon: "dashboard",
  };
  if (role === "brand")
    return {
      home,
      groups: [
        {
          id: "commercial",
          label: "commercial",
          icon: "commercial",
          links: [
            { href: "/portal/orders", label: "orders", icon: "orders" },
            { href: "/portal/sales", label: "sales", icon: "sales" },
          ],
        },
      ],
      standalone: [
        { href: "/portal/calendar", label: "calendar", icon: "calendar" },
        { href: "/portal/documents", label: "documents", icon: "documents" },
      ],
    };
  const groups: NavigationGroup[] = [
    {
      id: "commercial",
      label: "commercial",
      icon: "commercial",
      links: [
        { href: "/orders", label: "orders", icon: "orders" },
        { href: "/customers", label: "customers", icon: "customers" },
      ],
    },
    {
      id: "catalog",
      label: "catalog",
      icon: "catalog",
      links: [
        { href: "/brands", label: "brands", icon: "brands" },
        { href: "/seasons", label: "seasons", icon: "seasons" },
        { href: "/products", label: "products", icon: "products" },
      ],
    },
    {
      id: "finance",
      label: "finance",
      icon: "finance",
      links: [
        { href: "/invoices", label: "invoices", icon: "invoices" },
        { href: "/budgets", label: "budgets", icon: "budgets" },
        { href: "/commissions", label: "commissions", icon: "commissions" },
      ],
    },
  ];
  if (role === "admin" || role === "accounting")
    groups.push({
      id: "insights",
      label: "insights",
      icon: "insights",
      links: [
        ...(role === "admin"
          ? [
              {
                href: "/analysis",
                label: "analysis",
                icon: "analysis" as const,
              },
            ]
          : []),
        { href: "/imports", label: "imports", icon: "imports" },
      ],
    });
  if (role === "admin")
    groups.push({
      id: "settings",
      label: "settings",
      icon: "settings",
      links: [
        { href: "/settings/users", label: "users", icon: "customers" },
        { href: "/settings/audit", label: "audit", icon: "audit" },
      ],
    });
  return {
    home,
    groups,
    standalone: [
      { href: "/calendar", label: "calendar", icon: "calendar" },
      { href: "/documents", label: "documents", icon: "documents" },
    ],
  };
}

export function isNavigationActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

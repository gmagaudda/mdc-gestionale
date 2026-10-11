"use client";

import Image from "next/image";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { ArcProvider } from "@/components/arc/lib/arc-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="theme"
      themes={["light", "dark"]}
    >
      <ArcProvider link={Link} image={Image}>
        {children}
      </ArcProvider>
    </ThemeProvider>
  );
}

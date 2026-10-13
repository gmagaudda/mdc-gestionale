import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { Providers } from "./providers";
import messages from "@/messages/it.json";
import colors from "@/lib/pwa/colors.json";
import "@/components/arc/foundation.css";
import "@/lib/theme/sage.css";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: messages.common.appName,
  description: messages.common.appDescription,
  appleWebApp: { capable: true, title: messages.common.appName },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.backgroundLight },
    { media: "(prefers-color-scheme: dark)", color: colors.backgroundDark },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" data-accent="green" suppressHydrationWarning>
      <body className={`${geist.variable} ${inter.variable} antialiased`}>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

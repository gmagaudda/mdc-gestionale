import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { Providers } from "./providers";
import "@/components/arc/foundation.css";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Gestionale showroom",
  description: "Gestione interna dello showroom",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" data-accent="neutral" suppressHydrationWarning>
      <body className={`${geist.variable} ${inter.variable} antialiased`}>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

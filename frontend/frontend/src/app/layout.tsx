import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ClientErrorBoundary } from "@/components/ui/ClientErrorBoundary";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "FreqTrade Platform",
  description: "Multi-Strategy Trading System — FreqTrade UI",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={cn("dark", "font-sans", inter.variable)}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>
            <ClientErrorBoundary>{children}</ClientErrorBoundary>
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

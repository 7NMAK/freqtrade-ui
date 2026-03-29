import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ClientErrorBoundary } from "@/components/ui/ClientErrorBoundary";

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
    <html lang={locale} className="dark">
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

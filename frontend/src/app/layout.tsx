import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ClientErrorBoundary } from "@/components/ui/ClientErrorBoundary";

export const metadata: Metadata = {
  title: "FreqTrade Platform",
  description: "Multi-Strategy Trading System — FreqTrade UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <ToastProvider>
          <ClientErrorBoundary>{children}</ClientErrorBoundary>
        </ToastProvider>
      </body>
    </html>
  );
}

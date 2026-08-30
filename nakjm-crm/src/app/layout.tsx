import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "NAKJM CRM",
  description: "Client, project, procurement and vendor management for NAKJM's EPC business.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

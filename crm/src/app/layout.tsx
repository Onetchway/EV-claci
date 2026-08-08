import type { Metadata } from "next";

import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Livanto Green CRM — EV Charging Franchise",
  description:
    "Lead-to-handover CRM for EV charging franchise sales: pipeline, KYC, staged payments and audit trail.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

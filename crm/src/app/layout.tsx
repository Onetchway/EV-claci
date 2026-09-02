import { cookies } from "next/headers";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/ui";
import { adminConfigured, adminDb } from "@/lib/firebase/admin";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const DESCRIPTION = "Lead-to-handover CRM for EV charging franchise sales: pipeline, KYC, staged payments and audit trail.";

/**
 * Reads the same tenant_slug cookie the branding API route uses (see
 * api/organizations/branding/route.ts) so the browser tab shows this
 * tenant's own name, not a name baked in at build time — this file is
 * shared by every org on this deployment.
 */
export async function generateMetadata(): Promise<Metadata> {
  const slug = cookies().get("tenant_slug")?.value;
  if (!slug || !adminConfigured()) {
    return { title: "CRM — EV Charging Franchise", description: DESCRIPTION };
  }
  try {
    const snap = await adminDb().collection("organizations").where("slug", "==", slug).limit(1).get();
    const name = (snap.docs[0]?.data() as { name?: string } | undefined)?.name;
    return { title: name ? `${name} CRM — EV Charging Franchise` : "CRM — EV Charging Franchise", description: DESCRIPTION };
  } catch {
    return { title: "CRM — EV Charging Franchise", description: DESCRIPTION };
  }
}

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

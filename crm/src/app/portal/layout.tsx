"use client";

import { PortalAuthProvider } from "@/lib/portal-auth";

// The root layout (src/app/layout.tsx) already provides <ToastProvider>
// and <AuthProvider> (the CRM's own Google-Workspace auth) around every
// route, this one included — PortalAuthProvider is layered on top and is
// the only auth this route tree actually reads from (see usePortalAuth).
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalAuthProvider>
      <div className="min-h-screen bg-ink-50">{children}</div>
    </PortalAuthProvider>
  );
}

"use client";

import { useEffect, useState } from "react";

import { PortalAuthProvider } from "@/lib/portal-auth";

// The root layout (src/app/layout.tsx) already provides <ToastProvider>
// and <AuthProvider> (the CRM's own Google-Workspace auth) around every
// route, this one included — PortalAuthProvider is layered on top and is
// the only auth this route tree actually reads from (see usePortalAuth).
//
// This whole route tree is the franchise-investor portal, so it's gated
// behind the Alpha platform's "franchises" feature flag for tenants
// onboarded onto the platform (see src/lib/platform-features.ts). A
// standalone deploy, or one where the platform is unreachable, always
// passes this check (fail open).
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/platform-features")
      .then((r) => (r.ok ? r.json() : { franchises: true }))
      .then((data) => { if (!cancelled) setAllowed(data.franchises !== false); })
      .catch(() => { if (!cancelled) setAllowed(true); });
    return () => { cancelled = true; };
  }, []);

  if (allowed === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 text-center">
        <p className="text-sm text-ink-500">
          The franchise portal isn&apos;t enabled for this account. Contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <PortalAuthProvider>
      <div className="min-h-screen bg-ink-50">{children}</div>
    </PortalAuthProvider>
  );
}

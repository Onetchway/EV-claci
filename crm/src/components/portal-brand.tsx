"use client";

import { useEffect, useState } from "react";

import { subscribeSettings } from "@/lib/db/settings";

const FALLBACK_LOGO = "/logo.png";

/** Prefers the real uploaded logo (Settings → Company → Logo URL) — same source the CRM sidebar reads — falling back to the app's own bundled logo file otherwise, so there's never a moment with no mark rendered. */
export function PortalBrand({ className }: { className?: string }) {
  const [logoUrl, setLogoUrl] = useState<string>(FALLBACK_LOGO);
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(
    () => subscribeSettings(
      (s) => { setLogoUrl(s.company.logoUrl || FALLBACK_LOGO); setCompanyName(s.company.shortName); },
      () => setLogoUrl(FALLBACK_LOGO),
    ),
    [],
  );

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logoUrl} alt={companyName || "Company logo"} className={className ?? "h-8 max-w-[160px] object-contain"} />;
}

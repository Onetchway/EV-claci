"use client";

import { useEffect, useState } from "react";

import { subscribeSettings } from "@/lib/db/settings";

/** Prefers the real uploaded logo (Settings → Company → Logo URL) — same source the CRM sidebar reads — falling back to a recreated text wordmark when none has been uploaded yet. */
export function PortalBrand({ className }: { className?: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => subscribeSettings((s) => setLogoUrl(s.company.logoUrl || null), () => setLogoUrl(null)), []);

  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="Livanto Green" className={className ?? "h-8 max-w-[160px] object-contain"} />;
  }

  return (
    <div className={`flex flex-col items-center leading-[1.05] ${className ?? ""}`}>
      <div className="flex items-end text-lg font-extrabold tracking-tight text-navy-900">
        <span>liv</span>
        <svg viewBox="0 0 10 8" className="mx-px mb-[3px] h-[9px] w-[10px] fill-brand-600" aria-hidden>
          <polygon points="5,0 10,8 0,8" />
        </svg>
        <span>nto</span>
      </div>
      <span className="flex items-baseline text-lg font-extrabold tracking-tight text-brand-600">
        green
        <span className="ml-[3px] h-[4px] w-[4px] shrink-0 rounded-full bg-brand-600" />
      </span>
    </div>
  );
}

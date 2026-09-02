"use client";

import { useEffect, useState } from "react";

import { blankSettings, subscribeSettings } from "@/lib/db/settings";
import type { AppSettings } from "@/lib/types";

/** Live application settings (company/bank/LOI/finance defaults), org-wide. */
export function useSettings(): { settings: AppSettings; loading: boolean } {
  // Blank, not Livanto's own compiled defaults, so there's no flash of the
  // wrong tenant's identity before the real doc streams in.
  const [settings, setSettings] = useState<AppSettings>(blankSettings());
  const [loading, setLoading] = useState(true);

  useEffect(
    () => subscribeSettings((s) => { setSettings(s); setLoading(false); }, () => setLoading(false)),
    [],
  );

  return { settings, loading };
}

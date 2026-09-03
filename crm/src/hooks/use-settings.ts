"use client";

import { useEffect, useState } from "react";

import { defaultSettings, subscribeSettings } from "@/lib/db/settings";
import type { AppSettings } from "@/lib/types";

/** Live application settings (company/bank/LOI/finance defaults), org-wide. */
export function useSettings(): { settings: AppSettings; loading: boolean } {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  const [loading, setLoading] = useState(true);

  useEffect(
    () => subscribeSettings((s) => { setSettings(s); setLoading(false); }, () => setLoading(false)),
    [],
  );

  return { settings, loading };
}

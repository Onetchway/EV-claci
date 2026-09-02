"use client";

import { createContext, useContext } from "react";

/**
 * The signed-in user's org's enabled platform feature keys (platform/
 * database's feature_catalog, via api/platform-features/categories/route.ts)
 * — (app)/layout.tsx fetches this once and provides it here so any
 * descendant (not just the nav) can gate a specific action, not just an
 * entire page, on a super-admin-controlled feature toggle. `null` means
 * every feature is enabled (not onboarded onto the platform, or no key
 * set) — the same fail-open rule the nav itself already follows.
 */
export interface FeatureFlags {
  categories: string[] | null;
  keys: string[] | null;
}

const FeatureFlagsContext = createContext<FeatureFlags>({ categories: null, keys: null });

export const FeatureFlagsProvider = FeatureFlagsContext.Provider;

/** True when `key` is enabled for this org — fails open (true) when the platform key/keys list is unset. */
export function useFeatureEnabled(key: string): boolean {
  const { keys } = useContext(FeatureFlagsContext);
  return keys === null || keys.includes(key);
}

export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext);
}

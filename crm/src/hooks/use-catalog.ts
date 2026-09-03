"use client";

import { useEffect, useState } from "react";

import { CATALOG_LIST, setCustomCatalog, type ChargerSpec } from "@/lib/catalog";
import { subscribeCustomCatalog, type CustomChargerDoc } from "@/lib/db/catalog";

/**
 * Subscribes to the custom chargers added on the Catalogue page and keeps
 * src/lib/catalog.ts's module-level registry in sync, so buildQuote() (a
 * plain function called from all over the app, not just this hook's
 * subtree) can resolve a custom sku. Mount this once near the app root —
 * additional mounts are harmless, just redundant listeners.
 *
 * `custom`/`all` only include active chargers (what a NEW quotation should
 * offer); the registry behind getSpec() keeps archived ones too, so a lead
 * that already used one still resolves its price correctly.
 */
export function useChargerCatalog(): { builtIn: ChargerSpec[]; custom: CustomChargerDoc[]; all: ChargerSpec[] } {
  const [everCustom, setEverCustom] = useState<CustomChargerDoc[]>([]);

  useEffect(() => subscribeCustomCatalog((rows) => {
    setEverCustom(rows);
    setCustomCatalog(rows);
  }), []);

  const active = everCustom.filter((c) => c.active);
  return { builtIn: CATALOG_LIST, custom: active, all: [...CATALOG_LIST, ...active].sort((a, b) => a.kw - b.kw) };
}

"use client";

/** Unified search across leads, projects and partners for the header search bar. */

import { collection, getDocs, limit as fsLimit, query, where } from "firebase/firestore";

import { PARTNER_CATEGORY_LABEL } from "./constants";
import { getDb } from "./firebase/client";
import type { Lead, Partner, Project } from "./types";

export interface SearchResult {
  kind: "lead" | "project" | "partner";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function globalSearch(term: string): Promise<SearchResult[]> {
  const needle = term.trim().toLowerCase();
  if (needle.length < 2) return [];

  const db = getDb();

  const [leadsSnap, projectsSnap, partnersSnap] = await Promise.all([
    getDocs(query(collection(db, "leads"), where("search", "array-contains", needle), fsLimit(8))),
    getDocs(query(collection(db, "projects"), where("search", "array-contains", needle), fsLimit(8))),
    getDocs(query(collection(db, "partners"), fsLimit(200))),
  ]);

  const leadResults: SearchResult[] = leadsSnap.docs.map((d) => {
    const l = d.data() as Lead;
    return {
      kind: "lead",
      id: d.id,
      title: l.client?.name ?? l.code,
      subtitle: `${l.code} · ${l.client?.phone ?? ""}`,
      href: `/leads/${d.id}`,
    };
  });

  const projectResults: SearchResult[] = projectsSnap.docs.map((d) => {
    const p = d.data() as Project;
    return {
      kind: "project",
      id: d.id,
      title: p.name ?? p.code,
      subtitle: `${p.code} · ${p.site?.city ?? ""}`,
      href: `/projects/${d.id}`,
    };
  });

  const partnerResults: SearchResult[] = partnersSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Partner, "id">) }))
    .filter((p) => [p.name, p.code, p.phone, p.company].filter(Boolean).some((v) => v!.toLowerCase().includes(needle)))
    .slice(0, 8)
    .map((p) => ({
      kind: "partner" as const,
      id: p.id,
      title: p.name,
      subtitle: `${p.code} · ${PARTNER_CATEGORY_LABEL[p.category]}`,
      href: `/partners/${p.id}`,
    }));

  return [...leadResults, ...projectResults, ...partnerResults];
}

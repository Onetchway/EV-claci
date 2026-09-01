"use client";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { subscribeLeads, type LeadFilters } from "@/lib/db/leads";
import { subscribeActiveAgents } from "@/lib/db/users";
import { canSeeAllLeads } from "@/lib/permissions";
import type { AppUser, Lead } from "@/lib/types";

/**
 * Leads visible to the signed-in user. Agents are scoped to their own book at
 * the query level, which is also what the Firestore rules enforce — the two
 * must agree or the subscription errors out.
 */
export function useLeads(filters: Omit<LeadFilters, "ownerId"> = {}) {
  const { profile, role } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialise so a fresh object literal each render doesn't re-subscribe.
  const key = JSON.stringify(filters);

  useEffect(() => {
    if (!profile || !role) return;
    setLoading(true);
    const parsed = JSON.parse(key) as LeadFilters;
    const scoped: LeadFilters = {
      ...parsed,
      ownerId: canSeeAllLeads(role) ? parsed.ownerId ?? null : profile.uid,
    };

    return subscribeLeads(
      scoped,
      (rows) => {
        setLeads(rows);
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [profile, role, key]);

  return { leads, loading, error };
}

export function useAgents() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    return subscribeActiveAgents(
      (rows) => { setUsers(rows); setLoading(false); },
      () => setLoading(false),
    );
  }, [profile]);

  const agents = useMemo(() => users.filter((u) => u.role === "AGENT"), [users]);
  return { users, agents, loading };
}

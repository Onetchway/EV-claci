"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, LogOut, MapPin, Zap } from "lucide-react";

import { PortalBrand } from "@/components/portal-brand";
import { STAGE_META } from "@/lib/constants";
import { subscribeInvestorLeads } from "@/lib/db/leads";
import { usePortalAuth } from "@/lib/portal-auth";
import type { Lead } from "@/lib/types";
import { formatCompactINR, formatDate } from "@/lib/utils";

export default function PortalDashboardPage() {
  const router = useRouter();
  const { loading, user, phoneE164, signOut } = usePortalAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/portal/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!phoneE164) return;
    return subscribeInvestorLeads(phoneE164, (rows) => { setLeads(rows.filter((l) => !l.deletedAt)); setLeadsLoading(false); }, () => setLeadsLoading(false));
  }, [phoneE164]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <PortalBrand className="h-7 max-w-[130px] object-contain" />
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-500">{phoneE164}</span>
          <button
            onClick={() => void signOut().then(() => router.replace("/portal/login"))}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-ink-500 hover:bg-white hover:text-ink-800"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>

      <h1 className="mb-1 text-xl font-bold text-ink-900">Your franchise{leads.length !== 1 ? "s" : ""}</h1>
      <p className="mb-6 text-sm text-ink-500">Live status — updates as our team works on each one.</p>

      {leadsLoading ? (
        <div className="flex justify-center py-16 text-ink-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-card ring-1 ring-inset ring-ink-100">
          <p className="text-sm text-ink-700">We couldn&apos;t find a franchise under this number yet.</p>
          <p className="mt-1 text-xs text-ink-500">If you&apos;ve just spoken with our team, it can take a short while to appear here. Otherwise, please check with your relationship manager.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const meta = STAGE_META[lead.stage];
            return (
              <Link
                key={lead.id}
                href={`/portal/${lead.id}`}
                className="block rounded-xl bg-white p-4 shadow-card ring-1 ring-inset ring-ink-100 transition hover:ring-brand-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                      <Zap className="h-4 w-4 text-brand-600" /> {lead.code}
                    </p>
                    {lead.site?.locationName && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                        <MapPin className="h-3 w-3" /> {lead.site.locationName}
                        {lead.client?.city ? `, ${lead.client.city}` : ""}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${meta?.color ?? ""}`}>
                    {meta?.label ?? lead.stage}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
                  <span>Investment {formatCompactINR(lead.value)}</span>
                  <span>Updated {formatDate(lead.updatedAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

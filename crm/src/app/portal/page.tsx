"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, LogOut, MapPin, Zap } from "lucide-react";

import { PortalBrand } from "@/components/portal-brand";
import { useSettings } from "@/hooks/use-settings";
import { STAGE_META } from "@/lib/constants";
import { subscribeInvestorLeads } from "@/lib/db/leads";
import { usePortalAuth } from "@/lib/portal-auth";
import type { Lead } from "@/lib/types";
import { formatCompactINR, formatDate } from "@/lib/utils";

const STAGE_ACCENT: Record<string, string> = {
  NEW: "bg-slate-400",
  CONTACTED: "bg-sky-500",
  EOI: "bg-violet-500",
  AGREEMENT: "bg-amber-500",
  COMMISSIONING: "bg-orange-500",
  HANDOVER: "bg-emerald-500",
};

export default function PortalDashboardPage() {
  const router = useRouter();
  const { loading, user, phoneE164, signOut } = usePortalAuth();
  const { settings } = useSettings();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/portal/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!phoneE164) return;
    return subscribeInvestorLeads(
      phoneE164,
      (rows) => { setLeads(rows.filter((l) => !l.deletedAt)); setLeadsError(null); setLeadsLoading(false); },
      (e) => { setLeadsError(e.message); setLeadsLoading(false); },
    );
  }, [phoneE164]);

  const totals = useMemo(
    () => ({
      value: leads.reduce((a, l) => a + (l.value ?? 0), 0),
      paid: leads.reduce((a, l) => a + (l.paidAmount ?? 0), 0),
      live: leads.filter((l) => l.stage === "HANDOVER").length,
    }),
    [leads],
  );

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600">
        <div className="mx-auto max-w-3xl px-4 pb-14 pt-6 sm:px-6">
          <div className="flex items-center justify-between">
            <PortalBrand className="h-7 max-w-[130px] object-contain brightness-0 invert" />
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-white/70 sm:inline">{phoneE164}</span>
              <button
                onClick={() => void signOut().then(() => router.replace("/portal/login"))}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/90 hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Franchise partner portal</p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">Manage your franchise</h1>
            <p className="mt-2 max-w-lg text-sm text-white/80">
              Track stage, payments, project progress and documents for {leads.length > 1 ? "every franchise you've taken with us" : `your franchise with ${settings.company.shortName || "us"}`}, live.
            </p>
          </div>

          {leads.length > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-wide text-white/70">Franchises</p>
                <p className="mt-0.5 text-lg font-bold text-white">{leads.length}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-wide text-white/70">Total investment</p>
                <p className="mt-0.5 text-lg font-bold text-white">{formatCompactINR(totals.value)}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-wide text-white/70">Live stations</p>
                <p className="mt-0.5 text-lg font-bold text-white">{totals.live}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <div className="-mt-8">
          {leadsError ? (
            <div className="rounded-xl bg-white p-4 shadow-card ring-1 ring-inset ring-rose-200">
              <p className="text-sm font-medium text-rose-800">Something went wrong loading your franchises.</p>
              <p className="mt-1 text-xs text-rose-600">{leadsError}</p>
              <p className="mt-1 text-xs text-rose-600">If this says permission-denied, the site's database rules haven't been deployed yet — please tell your team.</p>
            </div>
          ) : leadsLoading ? (
            <div className="flex justify-center rounded-xl bg-white py-16 text-ink-400 shadow-card"><Loader2 className="h-6 w-6 animate-spin" /></div>
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
                    className="group flex overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-inset ring-ink-100 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-brand-300"
                  >
                    <div className={`w-1.5 shrink-0 ${STAGE_ACCENT[lead.stage] ?? "bg-ink-300"}`} />
                    <div className="flex-1 p-4">
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
                        <span className="flex items-center gap-1 text-ink-400 transition group-hover:text-brand-600">
                          Updated {formatDate(lead.updatedAt)}
                          <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

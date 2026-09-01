"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

import { LoiLetterArticle } from "@/components/lead/eoi-panel";
import { useSettings } from "@/hooks/use-settings";
import { subscribeLead } from "@/lib/db/leads";
import { usePortalAuth } from "@/lib/portal-auth";
import type { Lead } from "@/lib/types";

export default function PortalEoiPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const router = useRouter();
  const { loading, user } = usePortalAuth();
  const { settings } = useSettings();

  const [lead, setLead] = useState<Lead | null | undefined>(undefined);
  const [leadError, setLeadError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/portal/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!leadId) return;
    return subscribeLead(leadId, setLead, (e) => setLeadError(e.message));
  }, [leadId]);

  if (loading || !user || lead === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (leadError || !lead || !lead.eoi) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-ink-700">{leadError ? "We couldn't open this letter." : "No Expression of Interest has been issued yet."}</p>
          <Link href={leadId ? `/portal/${leadId}` : "/portal"} className="mt-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/portal/${leadId}`} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {lead.code}
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      <LoiLetterArticle
        eoi={lead.eoi}
        company={settings.company}
        bank={settings.bank}
        readOnly
        onPatch={() => undefined}
      />
    </main>
  );
}

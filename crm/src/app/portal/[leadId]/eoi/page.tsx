"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Printer } from "lucide-react";

import { LoiLetterArticle } from "@/components/lead/eoi-panel";
import { Button, Modal, useAsyncAction } from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import { subscribeLead } from "@/lib/db/leads";
import { usePortalAuth } from "@/lib/portal-auth";
import type { Lead } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function PortalEoiPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const router = useRouter();
  const { loading, user } = usePortalAuth();
  const { settings } = useSettings();
  const { busy, run } = useAsyncAction();

  const [lead, setLead] = useState<Lead | null | undefined>(undefined);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const eoi = lead.eoi;

  async function accept() {
    const token = await user!.getIdToken();
    const res = await fetch(`/api/portal/${leadId}/eoi-accept`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
    setConfirmOpen(false);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/portal/${leadId}`} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to {lead.code}
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {eoi.status === "ACCEPTED" && eoi.acceptedAt && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200 print:hidden">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          You accepted this on {formatDate(eoi.acceptedAt)}.
        </div>
      )}

      {eoi.status === "ISSUED" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-inset ring-sky-200 print:hidden">
          <span>Review the letter below, then accept it to confirm you're going ahead.</span>
          <Button variant="primary" size="sm" onClick={() => setConfirmOpen(true)}>
            Accept
          </Button>
        </div>
      )}

      <LoiLetterArticle
        eoi={eoi}
        company={settings.company}
        bank={settings.bank}
        readOnly
        onPatch={() => undefined}
      />

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Accept this Letter of Intent?"
        description={`This confirms ${eoi.number} on behalf of ${eoi.investorName} and cannot be undone from here.`}
        footer={
          <>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(accept, "Letter of Intent accepted.")}>
              <CheckCircle2 className="h-4 w-4" /> Yes, accept
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{eoi.number} · {eoi.investorName}</p>
      </Modal>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

import { SimpleDocumentFooter, SimpleDocumentHeader } from "@/components/simple-document";
import { useSettings } from "@/hooks/use-settings";
import { subscribeLead } from "@/lib/db/leads";
import { subscribePayments } from "@/lib/db/payments";
import { usePortalAuth } from "@/lib/portal-auth";
import type { Lead, Payment } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default function PortalReceiptPage() {
  const { leadId, paymentId } = useParams<{ leadId: string; paymentId: string }>();
  const router = useRouter();
  const { loading, user } = usePortalAuth();
  const { settings } = useSettings();

  const [lead, setLead] = useState<Lead | null | undefined>(undefined);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/portal/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!leadId) return;
    return subscribeLead(leadId, setLead, (e) => setError(e.message));
  }, [leadId]);

  useEffect(() => {
    if (!leadId) return;
    return subscribePayments(leadId, setPayments, (e) => setError(e.message));
  }, [leadId]);

  const payment = payments?.find((p) => p.id === paymentId);

  if (loading || !user || lead === undefined || payments === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (error || !lead || !payment) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-ink-700">We couldn&apos;t open this receipt.</p>
          <Link href={leadId ? `/portal/${leadId}` : "/portal"} className="mt-3 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
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

      <article className="rounded-xl border border-ink-200 bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
        <SimpleDocumentHeader
          company={settings.company}
          docLabel="Payment Receipt"
          docNumber={payment.reference || payment.id.slice(0, 10).toUpperCase()}
          meta={<p className="text-xs text-ink-500">Date: {formatDate(payment.paidAt ?? payment.createdAt)}</p>}
        />

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Received from</p>
            <p className="mt-0.5 font-medium text-ink-900">{lead.client?.name}</p>
            <p className="text-ink-600">{lead.client?.city}{lead.client?.state ? `, ${lead.client.state}` : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-500">Franchise</p>
            <p className="mt-0.5 font-medium text-ink-900">{lead.code}</p>
            {lead.site?.locationName && <p className="text-ink-600">{lead.site.locationName}</p>}
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead className="border-b border-ink-200">
            <tr>
              <th className="py-1.5 text-left font-semibold text-ink-700">Particulars</th>
              <th className="py-1.5 text-right font-semibold text-ink-700">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            <tr>
              <td className="py-2 text-ink-700">{titleCase(payment.milestone)} — base amount</td>
              <td className="py-2 text-right tabular-nums text-ink-800">{formatINR(payment.baseAmount)}</td>
            </tr>
            <tr>
              <td className="py-2 text-ink-700">GST{payment.gstPct ? ` @ ${Math.round(payment.gstPct * 100)}%` : ""}</td>
              <td className="py-2 text-right tabular-nums text-ink-800">{formatINR(payment.gstAmount)}</td>
            </tr>
          </tbody>
          <tfoot className="border-t-2 border-ink-200">
            <tr>
              <td className="py-2 font-semibold text-ink-900">Total received</td>
              <td className="py-2 text-right text-base font-bold tabular-nums text-brand-700">{formatINR(payment.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Mode</p>
            <p className="mt-0.5 text-ink-800">{payment.mode ? titleCase(payment.mode) : "—"}{payment.reference ? ` · ${payment.reference}` : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-ink-500">Status</p>
            <p className="mt-0.5 text-ink-800">{titleCase(payment.status)}</p>
          </div>
        </div>

        {payment.note && (
          <p className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{payment.note}</p>
        )}

        <SimpleDocumentFooter company={settings.company} />
      </article>

      <p className="mt-4 text-center text-xs text-ink-400 print:hidden">
        Generated {formatDateTime(new Date())} · This is a system-generated receipt.
      </p>
    </main>
  );
}

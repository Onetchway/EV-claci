"use client";

import { Loader2, MessageCircleQuestion, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { useSettings } from "@/hooks/use-settings";
import { subscribeLeadSupportRequests, submitSupportRequest } from "@/lib/db/support-requests";
import type { Lead, PortalSupportRequest } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const inputClass = "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500";

export function PortalSupportCard({ lead }: { lead: Lead }) {
  const { settings } = useSettings();
  const [requests, setRequests] = useState<PortalSupportRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => subscribeLeadSupportRequests(lead.id, setRequests), [lead.id]);

  async function send() {
    setError(null);
    if (!subject.trim() || !message.trim()) { setError("Add a subject and a message."); return; }
    setBusy(true);
    try {
      await submitSupportRequest(
        lead,
        { name: lead.client.name, phone: `+91${lead.client.phone}` },
        { subject, message },
      );
      setSubject("");
      setMessage("");
      setOpen(false);
      setSent(true);
      setTimeout(() => setSent(false), 4000);
    } catch (e) {
      setError((e as Error).message || "Could not send your message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-card ring-1 ring-inset ring-ink-100 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
          <MessageCircleQuestion className="h-4 w-4 text-brand-600" /> Contact us
        </h2>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
          >
            Raise a request
          </button>
        )}
      </div>

      {sent && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Sent — your relationship manager has been notified.</p>}

      {open && (
        <div className="mb-4 space-y-2.5">
          <input className={inputClass} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            placeholder="How can we help?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => void send()}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
            </button>
            <button disabled={busy} onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm text-ink-500 hover:bg-ink-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        !open && <p className="text-sm text-ink-500">Questions about payments, documents or your project — reach out any time.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-ink-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink-900">{r.subject}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${r.status === "OPEN" ? "bg-amber-100 text-amber-800 ring-amber-200" : "bg-emerald-100 text-emerald-800 ring-emerald-200"}`}>
                  {r.status === "OPEN" ? "Awaiting reply" : "Resolved"}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-600">{r.message}</p>
              <p className="mt-1 text-[11px] text-ink-400">{formatDateTime(r.createdAt)}</p>
              {r.reply && (
                <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2">
                  <p className="text-xs font-semibold text-brand-800">Reply from {settings.company.shortName || "us"}</p>
                  <p className="mt-0.5 text-sm text-brand-900">{r.reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

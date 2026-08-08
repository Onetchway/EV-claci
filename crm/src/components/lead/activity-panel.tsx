"use client";

import {
  ArrowRightLeft, CircleDot, FileSignature, FileText, IndianRupee, Landmark,
  Link2, MessageSquare, Phone, Plus, UserCheck, XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  Avatar, Button, Card, EmptyState, Field, Input, Select, Textarea, useAsyncAction,
} from "@/components/ui";
import type { ActivityType } from "@/lib/constants";
import { logActivity, subscribeLeadActivity } from "@/lib/db/activity";
import type { Activity, Actor, Lead } from "@/lib/types";
import { formatDateTime, formatRelative } from "@/lib/utils";

const ICONS: Partial<Record<ActivityType, typeof CircleDot>> = {
  CREATED: Plus,
  STAGE_CHANGED: ArrowRightLeft,
  STATUS_CHANGED: ArrowRightLeft,
  ASSIGNED: UserCheck,
  NOTE: MessageSquare,
  CALL: Phone,
  MEETING: MessageSquare,
  PAYMENT_ADDED: IndianRupee,
  PAYMENT_UPDATED: IndianRupee,
  PAYMENT_DELETED: IndianRupee,
  DOCUMENT_UPLOADED: FileText,
  DOCUMENT_VERIFIED: FileText,
  DOCUMENT_DELETED: FileText,
  REJECTED: XCircle,
  FINANCING_UPDATED: Landmark,
  LINKED: Link2,
  UNLINKED: Link2,
  EOI_CREATED: FileSignature,
  EOI_UPDATED: FileSignature,
  EOI_ISSUED: FileSignature,
};

const TONE: Partial<Record<ActivityType, string>> = {
  CREATED: "bg-brand-100 text-brand-700",
  STAGE_CHANGED: "bg-indigo-100 text-indigo-700",
  REJECTED: "bg-rose-100 text-rose-700",
  PAYMENT_ADDED: "bg-emerald-100 text-emerald-700",
  DOCUMENT_UPLOADED: "bg-sky-100 text-sky-700",
  NOTE: "bg-amber-100 text-amber-700",
  CALL: "bg-violet-100 text-violet-700",
  FINANCING_UPDATED: "bg-teal-100 text-teal-700",
  EOI_CREATED: "bg-indigo-100 text-indigo-700",
  EOI_ISSUED: "bg-emerald-100 text-emerald-700",
  LINKED: "bg-sky-100 text-sky-700",
};

const MANUAL_TYPES: { value: ActivityType; label: string }[] = [
  { value: "NOTE", label: "Note" },
  { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting / site visit" },
];

export function ActivityPanel({
  lead, actor, canEdit,
}: {
  lead: Lead; actor: Actor; canEdit: boolean;
}) {
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<ActivityType>("NOTE");
  const [message, setMessage] = useState("");
  const [followUp, setFollowUp] = useState("");
  const { busy, run } = useAsyncAction();

  useEffect(
    () =>
      subscribeLeadActivity(
        lead.id,
        lead.ownerId,
        (r) => { setRows(r); setLoading(false); },
        () => setLoading(false),
      ),
    [lead.id, lead.ownerId],
  );

  async function addNote() {
    const text = message.trim();
    if (!text) throw new Error("Write something first.");
    await logActivity({
      leadId: lead.id,
      ownerId: lead.ownerId,
      leadCode: lead.code,
      leadName: lead.client?.name,
      type,
      message: text,
      actor,
      followUpAt: followUp ? new Date(`${followUp}T00:00:00`) : null,
    });
    setMessage("");
    setFollowUp("");
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card title="Log an interaction">
          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as ActivityType)} options={MANUAL_TYPES} />
            </Field>
            <Field label="What happened?">
              <Textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Spoke to the client; he wants a 90 kW unit outside his hotel and will share the electricity bill by Friday."
              />
            </Field>
            <Field label="Set a reminder">
              <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button variant="primary" loading={busy} onClick={() => void run(addNote, "Logged.")}>
                Add to timeline
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card title="Activity & change history" subtitle="Every edit is attributed and timestamped.">
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-500">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing logged yet" description="Stage moves, payments, uploads and notes all appear here." />
        ) : (
          <ol className="relative space-y-4 border-l border-ink-200 pl-5">
            {rows.map((a) => {
              const Icon = ICONS[a.type] ?? CircleDot;
              return (
                <li key={a.id} className="relative">
                  <span
                    className={`absolute -left-[30px] inline-flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${
                      TONE[a.type] ?? "bg-ink-100 text-ink-600"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                  </span>

                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm text-ink-900">{a.message}</p>
                    <time className="shrink-0 text-xs text-ink-400" title={formatDateTime(a.at)}>
                      {formatRelative(a.at)}
                    </time>
                  </div>

                  {a.changes && a.changes.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 rounded-lg bg-ink-50 px-3 py-2">
                      {a.changes.map((c, i) => (
                        <li key={`${c.field}-${i}`} className="text-xs text-ink-600">
                          <span className="font-medium text-ink-700">{c.label}:</span>{" "}
                          <span className="text-rose-600 line-through decoration-rose-300">{c.from}</span>{" "}
                          <span className="text-ink-400">→</span>{" "}
                          <span className="text-emerald-700">{c.to}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                    <Avatar name={a.actor?.name} size={16} />
                    {a.actor?.name}
                    <span className="text-ink-300">·</span>
                    <span className="uppercase tracking-wide">{a.actor?.role?.replace("_", " ")}</span>
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

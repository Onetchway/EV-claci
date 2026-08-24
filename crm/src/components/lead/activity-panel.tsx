"use client";

import {
  ArrowRightLeft, AtSign, CircleDot, FileSignature, FileText, IndianRupee, Landmark,
  Link2, MessageSquare, Phone, Plus, UserCheck, XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Avatar, Button, Card, EmptyState, Field, Input, Select, useAsyncAction,
} from "@/components/ui";
import type { ActivityType } from "@/lib/constants";
import { logActivity, subscribeLeadActivity } from "@/lib/db/activity";
import { notifyMention } from "@/lib/db/notifications";
import { subscribeUsers } from "@/lib/db/users";
import { findMentions, splitMentions, type Mentionable } from "@/lib/mentions";
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
  EOI_REGENERATED: FileSignature,
  EOI_DELETED: XCircle,
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
  EOI_REGENERATED: "bg-indigo-100 text-indigo-700",
  EOI_DELETED: "bg-rose-100 text-rose-700",
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
  const [users, setUsers] = useState<Mentionable[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(
    () => subscribeUsers((rows) => setUsers(rows.map((u) => ({ uid: u.uid, name: u.name, email: u.email })))),
    [],
  );

  // The word currently being typed, when it starts with "@" — drives the
  // mention dropdown. Only looks at the fragment right before the cursor.
  const mentionQuery = useMemo(() => {
    const caret = textareaRef.current?.selectionStart ?? message.length;
    const before = message.slice(0, caret);
    const m = before.match(/@([\w'-]*)$/);
    return m ? m[1] ?? "" : null;
  }, [message]);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().replace(/\s+/g, "").includes(q)).slice(0, 6);
  }, [mentionQuery, users]);

  function insertMention(u: Mentionable) {
    const caret = textareaRef.current?.selectionStart ?? message.length;
    const before = message.slice(0, caret).replace(/@([\w'-]*)$/, `@${u.name.replace(/\s+/g, "")} `);
    const after = message.slice(caret);
    setMessage(before + after);
    setMentionOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function addNote() {
    const text = message.trim();
    if (!text) throw new Error("Write something first.");
    const mentioned = findMentions(text, users);
    await logActivity({
      leadId: lead.id,
      ownerId: lead.ownerId,
      leadCode: lead.code,
      leadName: lead.client?.name,
      type,
      message: text,
      actor,
      followUpAt: followUp ? new Date(`${followUp}T00:00:00`) : null,
      mentions: mentioned.map((u) => u.uid),
    });
    for (const u of mentioned) {
      if (u.uid === actor.uid) continue;
      notifyMention({
        toUid: u.uid,
        toEmail: u.email,
        mentionedByName: actor.name,
        leadCode: lead.code,
        leadId: lead.id,
        message: text,
      });
    }
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
            <Field
              label="What happened?"
              hint="Type @ to tag a teammate — they'll get an email."
            >
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  rows={2}
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); setMentionOpen(true); }}
                  onBlur={() => setTimeout(() => setMentionOpen(false), 120)}
                  placeholder="Spoke to the client; he wants a 90 kW unit outside his hotel and will share the electricity bill by Friday. Type @ to tag someone."
                  className="input min-h-[76px] w-full resize-y"
                />
                {mentionOpen && mentionQuery !== null && mentionMatches.length > 0 && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-64 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lg">
                    {mentionMatches.map((u) => (
                      <button
                        key={u.uid}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertMention(u)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-ink-50"
                      >
                        <Avatar name={u.name} size={20} />
                        <span className="truncate">{u.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                    <p className="text-sm text-ink-900">
                      {splitMentions(a.message, users).map((part, i) =>
                        part.mention ? (
                          <span
                            key={i}
                            className="inline-flex items-center gap-0.5 rounded bg-brand-50 px-1 font-medium text-brand-700"
                          >
                            <AtSign className="h-3 w-3" />
                            {part.mention.name}
                          </span>
                        ) : (
                          <span key={i}>{part.text}</span>
                        ),
                      )}
                    </p>
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

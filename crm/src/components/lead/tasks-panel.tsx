"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ListTodo, Play, XCircle } from "lucide-react";

import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea,
  useAsyncAction,
} from "@/components/ui";
import {
  FOLLOWUP_PRIORITIES, FOLLOWUP_PRIORITY_COLOR, FOLLOWUP_PRIORITY_LABEL,
  FOLLOWUP_TYPES, FOLLOWUP_TYPE_LABEL, type FollowupPriority, type FollowupType,
} from "@/lib/constants";
import {
  applySequence, cancelTask, completeTask, createTask, subscribeSequences,
  subscribeTasksForLead,
} from "@/lib/db/tasks";
import type { Actor, FollowupSequence, FollowupTask, Lead } from "@/lib/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export function TasksPanel({
  lead, actor, canEdit,
}: {
  lead: Lead; actor: Actor; canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<FollowupTask[]>([]);
  const [sequences, setSequences] = useState<FollowupSequence[]>([]);
  const [type, setType] = useState<FollowupType>("CALL");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<FollowupPriority>("MEDIUM");
  const [dueAt, setDueAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [outcomeFor, setOutcomeFor] = useState<FollowupTask | null>(null);
  const [outcome, setOutcome] = useState("");
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeTasksForLead(lead.id, setTasks), [lead.id]);
  useEffect(() => subscribeSequences(setSequences), []);

  const open = useMemo(() => tasks.filter((t) => t.status === "OPEN"), [tasks]);
  const closed = useMemo(() => tasks.filter((t) => t.status !== "OPEN"), [tasks]);

  async function add() {
    if (!title.trim()) throw new Error("Give the task a title.");
    await createTask({
      leadId: lead.id,
      leadCode: lead.code,
      leadName: lead.client?.name,
      type,
      title: title.trim(),
      notes: notes.trim(),
      ownerId: lead.ownerId,
      ownerName: lead.ownerName,
      priority,
      dueAt: new Date(`${dueAt}T09:00:00`),
    }, actor);
    setTitle("");
    setNotes("");
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card
          title="Schedule a task"
          actions={
            sequences.some((s) => s.active) ? (
              <Button size="sm" onClick={() => setSequenceOpen(true)}>
                <Play className="h-3.5 w-3.5" /> Apply a sequence
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Type">
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as FollowupType)}
                options={FOLLOWUP_TYPES.map((t) => ({ value: t, label: FOLLOWUP_TYPE_LABEL[t] }))}
              />
            </Field>
            <Field label="Title" className="sm:col-span-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up on EOI feedback" />
            </Field>
            <Field label="Priority">
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as FollowupPriority)}
                options={FOLLOWUP_PRIORITIES.map((p) => ({ value: p, label: FOLLOWUP_PRIORITY_LABEL[p] }))}
              />
            </Field>
            <Field label="Due date">
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </Field>
            <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
              <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button variant="primary" loading={busy} onClick={() => void run(add, "Task scheduled.")}>
                Schedule
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card title="Open tasks" subtitle={`${open.length} pending`}>
        {open.length === 0 ? (
          <EmptyState icon={<ListTodo className="h-8 w-8" />} title="No open tasks" description="Scheduled calls, visits and follow-ups appear here." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {open.map((t) => {
              const overdue = (t.dueAt?.toMillis?.() ?? 0) < Date.now();
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                      {t.title}
                      <Badge className={FOLLOWUP_PRIORITY_COLOR[t.priority]}>{FOLLOWUP_PRIORITY_LABEL[t.priority]}</Badge>
                    </p>
                    <p className={cn("text-xs", overdue ? "font-semibold text-rose-600" : "text-ink-500")}>
                      {FOLLOWUP_TYPE_LABEL[t.type]} · Due {formatDate(t.dueAt)} · {t.ownerName}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="sm" variant="primary" onClick={() => { setOutcomeFor(t); setOutcome(""); }}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Done
                      </Button>
                      <Button size="sm" onClick={() => void run(() => cancelTask(t), "Cancelled.")}>
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {closed.length > 0 && (
        <Card title="Completed / cancelled">
          <ul className="divide-y divide-ink-100">
            {closed.map((t) => (
              <li key={t.id} className="py-2 text-sm">
                <p className="flex items-center gap-2">
                  <span className={t.status === "DONE" ? "text-ink-700" : "text-ink-400 line-through"}>{t.title}</span>
                  <Badge>{t.status === "DONE" ? "Done" : "Cancelled"}</Badge>
                </p>
                {t.outcome && <p className="mt-0.5 text-xs text-ink-500">{t.outcome}</p>}
                <p className="mt-0.5 text-xs text-ink-400">{formatDateTime(t.completedAt ?? t.createdAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={!!outcomeFor} onClose={() => setOutcomeFor(null)} title="Mark task done" footer={
        <>
          <Button onClick={() => setOutcomeFor(null)}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={() =>
              void run(async () => {
                if (outcomeFor) await completeTask(outcomeFor, outcome.trim());
                setOutcomeFor(null);
              }, "Marked done.")
            }
          >
            Mark done
          </Button>
        </>
      }>
        <Field label="Outcome" hint="What happened? Optional but useful for the next person.">
          <Textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        </Field>
      </Modal>

      <Modal open={sequenceOpen} onClose={() => setSequenceOpen(false)} title="Apply a follow-up sequence"
        description="Creates one task per step, due relative to today."
        footer={<Button onClick={() => setSequenceOpen(false)}>Close</Button>}
      >
        <ul className="divide-y divide-ink-100">
          {sequences.filter((s) => s.active).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-ink-900">{s.name}</p>
                <p className="text-xs text-ink-500">{s.steps.length} steps</p>
              </div>
              <Button
                size="sm"
                variant="primary"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    await applySequence(lead, s, actor);
                    setSequenceOpen(false);
                  }, "Sequence applied.")
                }
              >
                Apply
              </Button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

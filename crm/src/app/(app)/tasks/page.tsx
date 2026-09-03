"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ListTodo, XCircle } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Input, Modal, PageHeader, Select, Spinner,
  StatCard, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  FOLLOWUP_PRIORITY_COLOR, FOLLOWUP_PRIORITY_LABEL, FOLLOWUP_TYPES,
  FOLLOWUP_TYPE_LABEL, type FollowupType,
} from "@/lib/constants";
import { cancelTask, completeTask, subscribeOpenTasks, summariseTasks } from "@/lib/db/tasks";
import { canSeeAllLeads } from "@/lib/permissions";
import type { FollowupTask } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export default function TasksPage() {
  const { profile, role } = useAuth();
  const viewer = useViewer();
  const [tasks, setTasks] = useState<FollowupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<FollowupType | "ALL">("ALL");
  const [mineOnly, setMineOnly] = useState(!canSeeAllLeads(viewer));
  const [search, setSearch] = useState("");
  const [outcomeFor, setOutcomeFor] = useState<FollowupTask | null>(null);
  const [outcome, setOutcome] = useState("");
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeOpenTasks((r) => { setTasks(r); setLoading(false); }, () => setLoading(false)), []);

  const rows = useMemo(() => {
    let r = tasks;
    if (mineOnly && profile) r = r.filter((t) => t.ownerId === profile.uid);
    if (type !== "ALL") r = r.filter((t) => t.type === type);
    const needle = search.trim().toLowerCase();
    if (needle) {
      r = r.filter((t) =>
        [t.title, t.leadCode, t.leadName, t.ownerName].filter(Boolean).some((v) => v!.toLowerCase().includes(needle)),
      );
    }
    return r;
  }, [tasks, mineOnly, type, search, profile]);

  const counts = useMemo(() => summariseTasks(rows), [rows]);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Scheduled calls, visits and follow-ups across your book."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open tasks" value={rows.length} icon={<ListTodo className="h-4 w-4" />} />
        <StatCard label="Due today" value={counts.dueToday} />
        <StatCard label="Overdue" value={counts.overdue} tone={counts.overdue ? "warn" : "default"} />
        <StatCard label="Calls due today" value={counts.byType.CALL ?? 0} />
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks, lead, agent…" className="min-w-[200px] flex-1" />
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as FollowupType | "ALL")}
          className="w-auto"
          options={[{ value: "ALL", label: "All types" }, ...FOLLOWUP_TYPES.map((t) => ({ value: t, label: FOLLOWUP_TYPE_LABEL[t] }))]}
        />
        {canSeeAllLeads(viewer) && (
          <label className="flex items-center gap-1.5 text-sm text-ink-600">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            My tasks only
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<ListTodo className="h-8 w-8" />} title="Nothing open" description="You're caught up." />
      ) : (
        <div className="card overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr>
                <th className="th">Task</th>
                <th className="th">Lead</th>
                <th className="th">Type</th>
                <th className="th">Owner</th>
                <th className="th">Due</th>
                <th className="th">Priority</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((t) => {
                const overdueRow = (t.dueAt?.toMillis?.() ?? 0) < Date.now();
                return (
                  <tr key={t.id} className="hover:bg-ink-50">
                    <td className="td font-medium text-ink-900">{t.title}</td>
                    <td className="td">
                      <Link href={`/leads/${t.leadId}`} className="text-brand-700 hover:underline">
                        {t.leadCode}
                      </Link>
                    </td>
                    <td className="td text-ink-600">{FOLLOWUP_TYPE_LABEL[t.type]}</td>
                    <td className="td text-ink-600">{t.ownerName}</td>
                    <td className={cn("td", overdueRow ? "font-semibold text-rose-600" : "text-ink-600")}>
                      {formatDate(t.dueAt)}
                    </td>
                    <td className="td">
                      <Badge className={FOLLOWUP_PRIORITY_COLOR[t.priority]}>{FOLLOWUP_PRIORITY_LABEL[t.priority]}</Badge>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="primary" onClick={() => { setOutcomeFor(t); setOutcome(""); }}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" onClick={() => void run(() => cancelTask(t), "Cancelled.")}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
        <Textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="What happened? (optional)" />
      </Modal>
    </>
  );
}

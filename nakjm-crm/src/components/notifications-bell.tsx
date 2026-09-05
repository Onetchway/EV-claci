"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";

import { subscribeIssues } from "@/lib/db/issues";
import { subscribeRfis } from "@/lib/db/rfis";
import { subscribeAllTasks } from "@/lib/db/tasks";
import type { Issue, ProjectTask, Rfi } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * Org-wide "what needs attention" digest — overdue tasks, high-priority
 * open issues, RFIs awaiting a response. Not personalized to "assigned to
 * me": TeamMember records aren't linked to an AppUser uid anywhere in this
 * app, so there's no reliable way to filter by the signed-in user yet.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [rfis, setRfis] = useState<Rfi[]>([]);

  useEffect(() => subscribeAllTasks(setTasks), []);
  useEffect(() => subscribeIssues(setIssues), []);
  useEffect(() => subscribeRfis(setRfis), []);

  const now = Date.now();
  const overdueTasks = useMemo(
    () => tasks.filter((t) => t.status !== "DONE" && t.dueDate?.seconds && t.dueDate.seconds * 1000 < now),
    [tasks, now],
  );
  const urgentIssues = useMemo(
    () => issues.filter((i) => (i.status === "OPEN" || i.status === "IN_PROGRESS") && (i.priority === "HIGH" || i.priority === "CRITICAL")),
    [issues],
  );
  const pendingRfis = useMemo(
    () => rfis.filter((r) => r.status === "OPEN" || r.status === "ASSIGNED" || r.status === "RESPONSE_REQUIRED"),
    [rfis],
  );

  const total = overdueTasks.length + urgentIssues.length + pendingRfis.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-navy-900"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-ink-200 bg-white shadow-2xl">
            <div className="border-b border-ink-200 px-4 py-3">
              <p className="text-sm font-semibold text-navy-900">Needs attention</p>
              <p className="text-xs text-ink-500">Across every project</p>
            </div>
            <div className="max-h-96 overflow-y-auto scroll-thin p-2">
              {total === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-ink-400">Nothing needs attention right now.</p>
              ) : (
                <>
                  <NotifGroup label="Overdue Tasks">
                    {overdueTasks.map((t) => (
                      <NotifRow key={t.id} href={`/projects/${t.projectId}`} onClick={() => setOpen(false)} title={t.title} sub={`${t.stageName} · Due ${formatDate(t.dueDate)}`} />
                    ))}
                  </NotifGroup>
                  <NotifGroup label="High-Priority Issues">
                    {urgentIssues.map((i) => (
                      <NotifRow key={i.id} href={`/projects/${i.projectId}`} onClick={() => setOpen(false)} title={i.title} sub={`${i.projectName} · ${i.priority}`} />
                    ))}
                  </NotifGroup>
                  <NotifGroup label="RFIs Awaiting Response">
                    {pendingRfis.map((r) => (
                      <NotifRow key={r.id} href={`/projects/${r.projectId}`} onClick={() => setOpen(false)} title={r.subject} sub={r.projectName} />
                    ))}
                  </NotifGroup>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotifGroup({ label, children }: { label: string; children: React.ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label} ({children.length})</p>
      {children}
    </div>
  );
}

function NotifRow({ href, onClick, title, sub }: { href: string; onClick: () => void; title: string; sub: string }) {
  return (
    <Link href={href} onClick={onClick} className={cn("block rounded-lg px-3 py-2 hover:bg-ink-100")}>
      <p className="truncate text-sm font-medium text-navy-900">{title}</p>
      <p className="truncate text-xs text-ink-500">{sub}</p>
    </Link>
  );
}

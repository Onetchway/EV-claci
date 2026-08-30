"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Textarea, useAsyncAction } from "@/components/ui";
import { ISSUE_PRIORITIES, ISSUE_STATUSES, type IssuePriority, type IssueStatus } from "@/lib/constants";
import { createIssue, subscribeIssues, updateIssue } from "@/lib/db/issues";
import { subscribeProjects } from "@/lib/db/projects";
import { canManageIssues } from "@/lib/permissions";
import type { Issue, Project } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const EMPTY_FORM = { title: "", description: "", projectId: "", priority: "MEDIUM" as IssuePriority, dueDate: "" };

export default function IssuesListPage() {
  const actor = useActor();
  const viewer = useViewer();
  const [rows, setRows] = useState<Issue[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<IssueStatus | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const { busy, run } = useAsyncAction();
  const canManage = canManageIssues(viewer);

  useEffect(() => subscribeIssues(setRows), []);
  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);

  const filtered = useMemo(() => (!rows ? [] : status === "ALL" ? rows : rows.filter((r) => r.status === status)), [rows, status]);
  const openCount = (rows ?? []).filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").length;

  async function onCreate() {
    if (!form.title.trim() || !form.projectId) return;
    await run(async () => {
      const project = projects.find((p) => p.id === form.projectId);
      if (!project) return;
      await createIssue({
        projectId: project.id, projectName: project.name, title: form.title, description: form.description,
        priority: form.priority, dueDate: form.dueDate ? new Date(form.dueDate) : null,
      }, actor);
      setShowForm(false); setForm(EMPTY_FORM);
    }, "Issue raised.");
  }

  return (
    <div>
      <PageHeader
        title="Issues"
        description="Site issues blocking progress, across every project."
        actions={
          <>
            <Select value={status} className="w-auto" options={[{ value: "ALL", label: "All statuses" }, ...ISSUE_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))]} onChange={(e) => setStatus(e.target.value as IssueStatus | "ALL")} />
            {canManage && <Button variant="primary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Raise Issue</Button>}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Issues" value={rows?.length ?? 0} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Open" value={openCount} tone={openCount > 0 ? "negative" : "positive"} />
      </div>

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<AlertTriangle className="h-8 w-8" />} title="No issues" description="Raise one here, or from a project's Issues tab." action={canManage ? <Button variant="primary" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> Raise Issue</Button> : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead><tr><th className="th">Title</th><th className="th">Project</th><th className="th">Priority</th><th className="th">Due</th><th className="th">Status</th></tr></thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium">{i.title}</td>
                  <td className="td"><Link href={`/projects/${i.projectId}`} className="text-ink-600 hover:underline">{i.projectName}</Link></td>
                  <td className="td"><Badge>{i.priority}</Badge></td>
                  <td className="td">{i.dueDate ? formatDate(i.dueDate) : "—"}</td>
                  <td className="td">
                    {canManage ? (
                      <Select value={i.status} className="w-auto" options={ISSUE_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))} onChange={(e) => void run(() => updateIssue(i, { status: e.target.value as IssueStatus }, actor), "Updated.")} />
                    ) : (
                      <Badge>{i.status.replace("_", " ")}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Raise Issue"
        footer={<><Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={() => void onCreate()} loading={busy}>Raise</Button></>}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" required className="col-span-2"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          <Field label="Project" required className="col-span-2"><Select value={form.projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))} /></Field>
          <Field label="Description" className="col-span-2"><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
          <Field label="Priority"><Select value={form.priority} options={ISSUE_PRIORITIES.map((p) => ({ value: p, label: p }))} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as IssuePriority }))} /></Field>
          <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  );
}

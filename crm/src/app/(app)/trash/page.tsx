"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, EmptyState, Modal, PageHeader, Spinner, useAsyncAction,
} from "@/components/ui";
import { deleteLead, restoreLead, subscribeLeads } from "@/lib/db/leads";
import { deleteProject, restoreProject, subscribeProjects } from "@/lib/db/projects";
import { canPermanentlyDelete, canTrash } from "@/lib/permissions";
import type { Lead, Project } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type Kind = "lead" | "project";

export default function TrashPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [permaTarget, setPermaTarget] = useState<{ kind: Kind; rows: (Lead | Project)[] } | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const { busy, run } = useAsyncAction();

  useEffect(() => {
    if (!canTrash(viewer)) { setLoading(false); return; }
    let leadsLoaded = false;
    let projectsLoaded = false;
    const maybeDone = () => { if (leadsLoaded && projectsLoaded) setLoading(false); };

    const unsubLeads = subscribeLeads(
      { max: 3000, includeTrashed: true },
      (rows) => { setLeads(rows); leadsLoaded = true; maybeDone(); },
      () => { leadsLoaded = true; maybeDone(); },
    );
    const unsubProjects = subscribeProjects(
      { max: 500, includeTrashed: true },
      (rows) => { setProjects(rows); projectsLoaded = true; maybeDone(); },
      () => { projectsLoaded = true; maybeDone(); },
    );
    return () => { unsubLeads(); unsubProjects(); };
  }, [viewer]);

  const totalCount = useMemo(() => leads.length + projects.length, [leads, projects]);
  const canForever = canPermanentlyDelete(viewer);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  }

  function toggleAll(rows: { id: string }[], set: Set<string>, setter: (s: Set<string>) => void) {
    if (rows.length > 0 && rows.every((r) => set.has(r.id))) setter(new Set());
    else setter(new Set(rows.map((r) => r.id)));
  }

  if (!canTrash(viewer)) {
    return (
      <EmptyState
        title="Admins only"
        description="Trash is available to admins and super admins."
        action={<Link href="/dashboard"><Button>Back to dashboard</Button></Link>}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Trash"
        description="Deleted leads and projects stay here, fully recoverable, until permanently deleted."
      />

      {loading ? (
        <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>
      ) : totalCount === 0 ? (
        <EmptyState icon={<Trash2 className="h-8 w-8" />} title="Trash is empty" description="Deleted leads and projects will show up here." />
      ) : (
        <div className="space-y-4">
          {leads.length > 0 && (
            <div className="space-y-2">
              {selectedLeads.size > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-ink-900 px-4 py-2.5 text-sm text-white">
                  <span>{selectedLeads.size} lead{selectedLeads.size === 1 ? "" : "s"} selected</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedLeads(new Set())} className="text-ink-300 hover:text-white">
                      Clear
                    </button>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={busy}
                      onClick={() =>
                        void run(async () => {
                          const targets = leads.filter((l) => selectedLeads.has(l.id));
                          for (const l of targets) await restoreLead(l, actor!);
                          setSelectedLeads(new Set());
                        }, "Leads restored.")
                      }
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore selected
                    </Button>
                    {canForever && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setPermaTarget({ kind: "lead", rows: leads.filter((l) => selectedLeads.has(l.id)) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete forever
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="card overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200 bg-ink-50">
                    <tr>
                      <th className="th w-8">
                        <input
                          type="checkbox"
                          checked={leads.length > 0 && leads.every((l) => selectedLeads.has(l.id))}
                          onChange={() => toggleAll(leads, selectedLeads, setSelectedLeads)}
                          aria-label="Select all trashed leads"
                        />
                      </th>
                      <th className="th">Lead</th>
                      <th className="th">Deleted by</th>
                      <th className="th">Deleted on</th>
                      <th className="th" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {leads.map((l) => (
                      <tr key={l.id} className="hover:bg-ink-50">
                        <td className="td w-8">
                          <input
                            type="checkbox"
                            checked={selectedLeads.has(l.id)}
                            onChange={() => toggle(selectedLeads, setSelectedLeads, l.id)}
                            aria-label={`Select ${l.client?.name}`}
                          />
                        </td>
                        <td className="td">
                          <span className="font-medium text-ink-900">{l.client?.name}</span>
                          <span className="mt-0.5 block text-xs text-ink-500">{l.code}</span>
                        </td>
                        <td className="td text-ink-600">{l.deletedBy?.name ?? "—"}</td>
                        <td className="td text-ink-500">{formatDateTime(l.deletedAt)}</td>
                        <td className="td">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="primary"
                              loading={busy}
                              onClick={() => void run(() => restoreLead(l, actor!), "Lead restored.")}
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Restore
                            </Button>
                            {canForever && (
                              <Button size="sm" variant="danger" onClick={() => setPermaTarget({ kind: "lead", rows: [l] })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {projects.length > 0 && (
            <div className="space-y-2">
              {selectedProjects.size > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-ink-900 px-4 py-2.5 text-sm text-white">
                  <span>{selectedProjects.size} project{selectedProjects.size === 1 ? "" : "s"} selected</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedProjects(new Set())} className="text-ink-300 hover:text-white">
                      Clear
                    </button>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={busy}
                      onClick={() =>
                        void run(async () => {
                          const targets = projects.filter((p) => selectedProjects.has(p.id));
                          for (const p of targets) await restoreProject(p, actor!);
                          setSelectedProjects(new Set());
                        }, "Projects restored.")
                      }
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore selected
                    </Button>
                    {canForever && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setPermaTarget({ kind: "project", rows: projects.filter((p) => selectedProjects.has(p.id)) })}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete forever
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="card overflow-x-auto scroll-thin">
                <table className="w-full">
                  <thead className="border-b border-ink-200 bg-ink-50">
                    <tr>
                      <th className="th w-8">
                        <input
                          type="checkbox"
                          checked={projects.length > 0 && projects.every((p) => selectedProjects.has(p.id))}
                          onChange={() => toggleAll(projects, selectedProjects, setSelectedProjects)}
                          aria-label="Select all trashed projects"
                        />
                      </th>
                      <th className="th">Project</th>
                      <th className="th">Deleted by</th>
                      <th className="th">Deleted on</th>
                      <th className="th" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {projects.map((p) => (
                      <tr key={p.id} className="hover:bg-ink-50">
                        <td className="td w-8">
                          <input
                            type="checkbox"
                            checked={selectedProjects.has(p.id)}
                            onChange={() => toggle(selectedProjects, setSelectedProjects, p.id)}
                            aria-label={`Select ${p.name}`}
                          />
                        </td>
                        <td className="td">
                          <span className="font-medium text-ink-900">{p.name}</span>
                          <span className="mt-0.5 block text-xs text-ink-500">{p.code}</span>
                        </td>
                        <td className="td text-ink-600">{p.deletedBy?.name ?? "—"}</td>
                        <td className="td text-ink-500">{formatDateTime(p.deletedAt)}</td>
                        <td className="td">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="primary"
                              loading={busy}
                              onClick={() => void run(() => restoreProject(p, actor!), "Project restored.")}
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Restore
                            </Button>
                            {canForever && (
                              <Button size="sm" variant="danger" onClick={() => setPermaTarget({ kind: "project", rows: [p] })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={!!permaTarget}
        onClose={() => setPermaTarget(null)}
        title={`Permanently delete ${permaTarget?.rows.length ?? 0} ${permaTarget?.kind === "project" ? "project" : "lead"}${(permaTarget?.rows.length ?? 0) === 1 ? "" : "s"}`}
        description="This cannot be undone — the records and their documents/payments are gone for good."
        footer={
          <>
            <Button onClick={() => setPermaTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!permaTarget) return;
                  if (permaTarget.kind === "lead") {
                    for (const row of permaTarget.rows) await deleteLead(row as Lead);
                    setSelectedLeads(new Set());
                  } else {
                    for (const row of permaTarget.rows) await deleteProject(row as Project);
                    setSelectedProjects(new Set());
                  }
                  setPermaTarget(null);
                }, "Permanently deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete forever
            </Button>
          </>
        }
      >
        {permaTarget && (
          <div className="text-sm text-ink-700">
            <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Cannot be undone</Badge>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {permaTarget.rows.map((row) => (
                <li key={row.id}>
                  {permaTarget.kind === "lead" ? (row as Lead).client?.name : (row as Project).name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}

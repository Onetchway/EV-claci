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

export default function TrashPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [permaTarget, setPermaTarget] = useState<{ kind: "lead" | "project"; row: Lead | Project } | null>(null);
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
            <div className="card overflow-x-auto scroll-thin">
              <table className="w-full">
                <thead className="border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="th">Lead</th>
                    <th className="th">Deleted by</th>
                    <th className="th">Deleted on</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {leads.map((l) => (
                    <tr key={l.id} className="hover:bg-ink-50">
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
                          {canPermanentlyDelete(viewer) && (
                            <Button size="sm" variant="danger" onClick={() => setPermaTarget({ kind: "lead", row: l })}>
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
          )}

          {projects.length > 0 && (
            <div className="card overflow-x-auto scroll-thin">
              <table className="w-full">
                <thead className="border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="th">Project</th>
                    <th className="th">Deleted by</th>
                    <th className="th">Deleted on</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {projects.map((p) => (
                    <tr key={p.id} className="hover:bg-ink-50">
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
                          {canPermanentlyDelete(viewer) && (
                            <Button size="sm" variant="danger" onClick={() => setPermaTarget({ kind: "project", row: p })}>
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
          )}
        </div>
      )}

      <Modal
        open={!!permaTarget}
        onClose={() => setPermaTarget(null)}
        title="Permanently delete"
        description="This cannot be undone — the record and its documents/payments are gone for good."
        footer={
          <>
            <Button onClick={() => setPermaTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!permaTarget) return;
                  if (permaTarget.kind === "lead") await deleteLead(permaTarget.row as Lead);
                  else await deleteProject(permaTarget.row as Project);
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
          <p className="text-sm text-ink-700">
            <Badge className="bg-rose-100 text-rose-800 ring-rose-200">Cannot be undone</Badge>
            <span className="mt-2 block">
              {permaTarget.kind === "lead" ? (permaTarget.row as Lead).client?.name : (permaTarget.row as Project).name}
            </span>
          </p>
        )}
      </Modal>
    </>
  );
}

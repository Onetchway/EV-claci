"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { EntityDocuments } from "@/components/entity-documents";
import {
  Badge, Button, Card, EmptyState, Modal, PageHeader, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import { SITE_VISIT_STATUS_META, SITE_VISIT_STATUSES, type SiteVisitStatus } from "@/lib/constants";
import { deleteSiteVisit, submitSiteVisitObservations, subscribeSiteVisit, updateSiteVisit } from "@/lib/db/site-visits";
import { canManageProjects, canSubmitSiteReports, canTrash } from "@/lib/permissions";
import type { SiteVisit } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function SiteVisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [visit, setVisit] = useState<SiteVisit | null | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [observations, setObservations] = useState("");

  useEffect(() => subscribeSiteVisit(id, setVisit), [id]);
  useEffect(() => { if (visit) setObservations(visit.observations ?? ""); }, [visit]);

  if (visit === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (visit === null) return <EmptyState title="Site visit not found" action={<Link href="/site-visits"><Button>Back to site visits</Button></Link>} />;

  async function onStatusChange(status: SiteVisitStatus) {
    await run(() => updateSiteVisit(visit!, { status }, actor), `Marked ${status}.`);
  }

  async function onSubmitObservations() {
    await run(() => submitSiteVisitObservations(visit!, observations, actor), "Observations recorded.");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={visit.visitNo}
        description={visit.projectName}
        actions={
          <>
            {canManageProjects(viewer) ? (
              <Select
                value={visit.status}
                options={SITE_VISIT_STATUSES.map((s) => ({ value: s, label: SITE_VISIT_STATUS_META[s].label }))}
                onChange={(e) => void onStatusChange(e.target.value as SiteVisitStatus)}
              />
            ) : (
              <Badge className={SITE_VISIT_STATUS_META[visit.status].className}>{SITE_VISIT_STATUS_META[visit.status].label}</Badge>
            )}
            {canManageProjects(viewer) && (
              <Link href={`/site-visits/${visit.id}/edit`}><Button><Pencil className="h-4 w-4" /> Edit</Button></Link>
            )}
            {canTrash(viewer) && (
              <Button className="text-rose-700 hover:bg-rose-50" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Site details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div><dt className="text-ink-500">Project</dt><dd><Link href={`/projects/${visit.projectId}`} className="text-brand-700 hover:underline">{visit.projectName}</Link></dd></div>
              <div><dt className="text-ink-500">Site Name</dt><dd>{visit.siteName || "—"}</dd></div>
              <div><dt className="text-ink-500">Charger Type</dt><dd>{visit.chargerType || "—"}</dd></div>
              <div><dt className="text-ink-500">Scheduled Date</dt><dd>{formatDate(visit.scheduledDate)}</dd></div>
              {visit.locationLink && (
                <div className="col-span-2">
                  <dt className="text-ink-500">Location</dt>
                  <dd><a href={visit.locationLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">Open in Maps <ExternalLink className="h-3.5 w-3.5" /></a></dd>
                </div>
              )}
              {visit.address && (<div className="col-span-2"><dt className="text-ink-500">Address</dt><dd className="whitespace-pre-line">{visit.address}</dd></div>)}
            </dl>
          </Card>

          <Card title="Point of contact">
            {visit.pocName || visit.pocContact || visit.pocEmail ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                <div><dt className="text-ink-500">Name</dt><dd>{visit.pocName || "—"}</dd></div>
                <div><dt className="text-ink-500">Contact</dt><dd>{visit.pocContact || "—"}</dd></div>
                {visit.pocEmail && <div className="col-span-2"><dt className="text-ink-500">Email</dt><dd>{visit.pocEmail}</dd></div>}
              </dl>
            ) : (
              <p className="text-sm text-ink-400">No POC details added yet.</p>
            )}
          </Card>

          {visit.notes && (
            <Card title="Notes / instructions"><p className="whitespace-pre-line text-sm text-ink-700">{visit.notes}</p></Card>
          )}

          <Card title="Observations" subtitle="Filled in by the engineer after the site visit.">
            {canSubmitSiteReports(viewer) ? (
              <div className="space-y-3">
                <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="What was found on site — condition, findings, recommendations…" />
                <Button variant="primary" onClick={() => void onSubmitObservations()} loading={busy}>Save Observations</Button>
                {visit.observedBy && (
                  <p className="text-xs text-ink-500">Last recorded by {visit.observedBy.name} · {formatDateTime(visit.observedAt)}</p>
                )}
              </div>
            ) : visit.observations ? (
              <>
                <p className="whitespace-pre-line text-sm text-ink-700">{visit.observations}</p>
                {visit.observedBy && <p className="mt-2 text-xs text-ink-500">Recorded by {visit.observedBy.name} · {formatDateTime(visit.observedAt)}</p>}
              </>
            ) : (
              <p className="text-sm text-ink-400">No observations recorded yet.</p>
            )}
          </Card>

          <EntityDocuments projectId={visit.projectId} entityType="SITE_VISIT" entityId={visit.id} defaultDocType="SITE_VISIT_REPORT" title="Site Visit Documents" />
        </div>

        <div className="space-y-4">
          <Card title="Assigned team">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-ink-500">Manager</dt><dd>{visit.managerName || "—"}</dd></div>
              <div>
                <dt className="text-ink-500">Engineers</dt>
                {visit.assignedEngineers.length ? (
                  <ul className="mt-1 space-y-1">
                    {visit.assignedEngineers.map((e) => <li key={e.teamMemberId} className="text-ink-900">{e.name}</li>)}
                  </ul>
                ) : (
                  <dd className="text-ink-400">None assigned yet.</dd>
                )}
              </div>
            </dl>
          </Card>

          <EntityActivityLog entityType="SITE_VISIT" entityId={visit.id} />
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this site visit?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { await deleteSiteVisit(visit!, actor); router.push("/site-visits"); }, "Site visit deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        <p className="text-sm text-ink-700">{visit.visitNo} — {visit.projectName}</p>
      </Modal>
    </div>
  );
}

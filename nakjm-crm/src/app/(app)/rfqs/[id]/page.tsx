"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileSignature, Pencil, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { EntityDocuments } from "@/components/entity-documents";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Spinner, Textarea, useAsyncAction } from "@/components/ui";
import { RFQ_STATUS_META, RFQ_STATUSES, type RfqStatus } from "@/lib/constants";
import { subscribeProjects } from "@/lib/db/projects";
import { deleteRfq, subscribeRfq, updateRfq } from "@/lib/db/rfqs";
import { canManageProcurement, canTrash } from "@/lib/permissions";
import type { Project, Rfq } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function RfqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const [rfq, setRfq] = useState<Rfq | null | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<{ subject: string; projectId: string; receivedDate: string; dueDate: string; notes: string } | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeRfq(id, setRfq), [id]);
  useEffect(() => { if (rfq) return subscribeProjects({ status: "ALL", clientId: rfq.clientId, max: 500 }, setProjects); }, [rfq?.clientId]);

  if (rfq === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (rfq === null) return <EmptyState title="RFQ not found" action={<Link href="/rfqs"><Button>Back to RFQs</Button></Link>} />;

  function openEdit() {
    setForm({
      subject: rfq!.subject, projectId: rfq!.projectId ?? "",
      receivedDate: rfq!.receivedDate ? rfq!.receivedDate.toDate().toISOString().slice(0, 10) : "",
      dueDate: rfq!.dueDate ? rfq!.dueDate.toDate().toISOString().slice(0, 10) : "",
      notes: rfq!.notes ?? "",
    });
    setEditOpen(true);
  }

  async function onSave() {
    if (!form || !form.subject.trim()) return;
    await run(async () => {
      const project = projects.find((p) => p.id === form.projectId);
      await updateRfq(rfq!, {
        subject: form.subject, projectId: form.projectId || null, projectName: project?.name,
        receivedDate: form.receivedDate ? new Date(form.receivedDate) : null,
        dueDate: form.dueDate ? new Date(form.dueDate) : null,
        notes: form.notes,
      }, actor);
      setEditOpen(false);
    }, "RFQ updated.");
  }

  async function onStatusChange(status: RfqStatus) {
    await run(() => updateRfq(rfq!, { status }, actor), `Marked ${RFQ_STATUS_META[status].label}.`);
  }

  const convertHref = rfq.projectId ? `/quotations/new?projectId=${rfq.projectId}&rfqId=${rfq.id}` : null;

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-ink-400">{rfq.rfqNo}</p>
            <h1 className="text-xl font-semibold text-ink-900">{rfq.subject}</h1>
            <p className="text-sm text-ink-500"><Link href={`/clients/${rfq.clientId}`} className="text-brand-700 hover:underline">{rfq.clientName}</Link>{rfq.projectName ? ` · ${rfq.projectName}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            {canManageProcurement(viewer) ? (
              <Select
                value={rfq.status}
                options={RFQ_STATUSES.map((s) => ({ value: s, label: RFQ_STATUS_META[s].label }))}
                onChange={(e) => void onStatusChange(e.target.value as RfqStatus)}
              />
            ) : (
              <Badge className={RFQ_STATUS_META[rfq.status].className}>{RFQ_STATUS_META[rfq.status].label}</Badge>
            )}
            {canManageProcurement(viewer) && rfq.status !== "QUOTED" && (
              convertHref ? (
                <Link href={convertHref}><Button variant="primary"><FileSignature className="h-4 w-4" /> Convert to Quotation</Button></Link>
              ) : (
                <Button disabled title="Link a project to this RFQ first (Edit)"><FileSignature className="h-4 w-4" /> Convert to Quotation</Button>
              )
            )}
            {canManageProcurement(viewer) && <Button onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>}
            {canTrash(viewer) && <Button className="text-rose-700 hover:bg-rose-50" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete</Button>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-ink-100 pt-5 text-sm md:grid-cols-4">
          <div><p className="text-ink-400">Received</p><p className="font-medium">{formatDate(rfq.receivedDate)}</p></div>
          <div><p className="text-ink-400">Due</p><p className="font-medium">{formatDate(rfq.dueDate)}</p></div>
          <div><p className="text-ink-400">Project</p><p className="font-medium">{rfq.projectName || "Not linked yet"}</p></div>
        </div>

        {rfq.notes && <p className="mt-4 whitespace-pre-line border-t border-ink-100 pt-4 text-sm text-ink-600">{rfq.notes}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {rfq.projectId ? (
          <EntityDocuments projectId={rfq.projectId} entityType="RFQ" entityId={rfq.id} defaultDocType="OTHER" title="Documents" />
        ) : (
          <div className="card card-pad">
            <h2 className="mb-2 text-sm font-semibold text-ink-900">Documents</h2>
            <p className="text-sm text-ink-500">Link a project to this RFQ (Edit) to attach documents.</p>
          </div>
        )}

        <EntityActivityLog entityType="RFQ" entityId={rfq.id} />
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit RFQ"
        wide
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>Save</Button></>}
      >
        {form && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subject" required className="col-span-2"><Input value={form.subject} onChange={(e) => setForm((f) => f && { ...f, subject: e.target.value })} /></Field>
            <Field label="Project" hint="Link a project to enable Convert to Quotation.">
              <Select value={form.projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setForm((f) => f && { ...f, projectId: e.target.value })} />
            </Field>
            <Field label="Received Date"><Input type="date" value={form.receivedDate} onChange={(e) => setForm((f) => f && { ...f, receivedDate: e.target.value })} /></Field>
            <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => f && { ...f, dueDate: e.target.value })} /></Field>
            <Field label="Notes" className="col-span-2"><Textarea value={form.notes} onChange={(e) => setForm((f) => f && { ...f, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this RFQ?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { await deleteRfq(rfq!, actor); router.push("/rfqs"); }, "RFQ deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        <p className="text-sm text-ink-700">{rfq.rfqNo} — {rfq.subject}</p>
      </Modal>
    </div>
  );
}

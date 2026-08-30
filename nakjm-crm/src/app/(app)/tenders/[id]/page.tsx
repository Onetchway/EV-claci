"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Briefcase, Pencil, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Spinner, Textarea, useAsyncAction } from "@/components/ui";
import { TENDER_STATUS_META, TENDER_STATUSES, type TenderStatus } from "@/lib/constants";
import { getProject } from "@/lib/db/projects";
import { subscribeTender, trashTender, updateTender } from "@/lib/db/tenders";
import { canManageTenders, canTrash } from "@/lib/permissions";
import type { Project, Tender } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function TenderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const [tender, setTender] = useState<Tender | null | undefined>(undefined);
  const [linkedProject, setLinkedProject] = useState<Project | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [form, setForm] = useState<{
    title: string; tenderNumber: string; department: string; authority: string; location: string;
    tenderValue: string; emdAmount: string; tenderFee: string; submissionDate: string; openingDate: string; notes: string;
  } | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeTender(id, setTender), [id]);
  useEffect(() => {
    if (tender?.linkedProjectId) void getProject(tender.linkedProjectId).then(setLinkedProject);
    else setLinkedProject(null);
  }, [tender?.linkedProjectId]);

  if (tender === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (tender === null) return <EmptyState title="Tender not found" action={<Link href="/tenders"><Button>Back to tenders</Button></Link>} />;

  function openEdit() {
    setForm({
      title: tender!.title, tenderNumber: tender!.tenderNumber ?? "", department: tender!.department ?? "",
      authority: tender!.authority ?? "", location: tender!.location ?? "",
      tenderValue: String(tender!.tenderValue ?? 0), emdAmount: String(tender!.emdAmount ?? 0), tenderFee: String(tender!.tenderFee ?? 0),
      submissionDate: tender!.submissionDate ? tender!.submissionDate.toDate().toISOString().slice(0, 10) : "",
      openingDate: tender!.openingDate ? tender!.openingDate.toDate().toISOString().slice(0, 10) : "",
      notes: tender!.notes ?? "",
    });
    setEditOpen(true);
  }

  async function onSave() {
    if (!form || !form.title.trim()) return;
    await run(async () => {
      await updateTender(tender!, {
        title: form.title, tenderNumber: form.tenderNumber, department: form.department, authority: form.authority, location: form.location,
        tenderValue: Number(form.tenderValue) || 0, emdAmount: Number(form.emdAmount) || 0, tenderFee: Number(form.tenderFee) || 0,
        submissionDate: form.submissionDate ? new Date(form.submissionDate) : null,
        openingDate: form.openingDate ? new Date(form.openingDate) : null,
        notes: form.notes,
      }, actor);
      setEditOpen(false);
    }, "Tender updated.");
  }

  async function onStatusChange(status: TenderStatus) {
    await run(() => updateTender(tender!, { status }, actor), `Marked ${TENDER_STATUS_META[status].label}.`);
  }

  const newProjectHref = `/projects/new?tenderId=${tender.id}&clientId=${tender.clientId}&name=${encodeURIComponent(tender.title)}&contractValue=${tender.tenderValue ?? 0}`;

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-ink-400">{tender.tenderCode}{tender.tenderNumber ? ` · ${tender.tenderNumber}` : ""}</p>
            <h1 className="text-xl font-semibold text-ink-900">{tender.title}</h1>
            <p className="text-sm text-ink-500"><Link href={`/clients/${tender.clientId}`} className="text-brand-700 hover:underline">{tender.clientName}</Link> · {tender.authority || "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            {canManageTenders(viewer) ? (
              <Select
                value={tender.status}
                options={TENDER_STATUSES.map((s) => ({ value: s, label: TENDER_STATUS_META[s].label }))}
                onChange={(e) => void onStatusChange(e.target.value as TenderStatus)}
              />
            ) : (
              <Badge className={TENDER_STATUS_META[tender.status].className}>{TENDER_STATUS_META[tender.status].label}</Badge>
            )}
            {canManageTenders(viewer) && <Button size="sm" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
            {canTrash(viewer) && (
              <Button size="sm" className="text-rose-700 hover:bg-rose-50" onClick={() => setTrashOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-ink-100 pt-5 text-sm md:grid-cols-4">
          <div><p className="text-ink-400">Department</p><p className="font-medium">{tender.department || "—"}</p></div>
          <div><p className="text-ink-400">Location</p><p className="font-medium">{tender.location || "—"}</p></div>
          <div><p className="text-ink-400">Submission Date</p><p className="font-medium">{formatDate(tender.submissionDate)}</p></div>
          <div><p className="text-ink-400">Opening Date</p><p className="font-medium">{formatDate(tender.openingDate)}</p></div>
          <div><p className="text-ink-400">Tender Value</p><p className="font-medium">{formatINR(tender.tenderValue)}</p></div>
          <div><p className="text-ink-400">EMD</p><p className="font-medium">{formatINR(tender.emdAmount)}</p></div>
          <div><p className="text-ink-400">Tender Fee</p><p className="font-medium">{formatINR(tender.tenderFee)}</p></div>
        </div>

        {tender.notes && (
          <p className="mt-4 whitespace-pre-line border-t border-ink-100 pt-4 text-sm text-ink-600">{tender.notes}</p>
        )}
      </div>

      <div className="card card-pad">
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Project</h2>
        {linkedProject ? (
          <Link href={`/projects/${linkedProject.id}`} className="flex items-center gap-2 text-brand-700 hover:underline">
            <Briefcase className="h-4 w-4" /> {linkedProject.code} — {linkedProject.name}
          </Link>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-500">No project created from this tender yet.</p>
            {canManageTenders(viewer) && (
              <Link href={newProjectHref}>
                <Button variant="primary" size="sm"><Briefcase className="h-3.5 w-3.5" /> Create Project</Button>
              </Link>
            )}
          </div>
        )}
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Tender"
        wide
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>Save</Button></>}
      >
        {form && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tender Title" required className="col-span-2"><Input value={form.title} onChange={(e) => setForm((f) => f && { ...f, title: e.target.value })} /></Field>
            <Field label="Tender Number"><Input value={form.tenderNumber} onChange={(e) => setForm((f) => f && { ...f, tenderNumber: e.target.value })} /></Field>
            <Field label="Department"><Input value={form.department} onChange={(e) => setForm((f) => f && { ...f, department: e.target.value })} /></Field>
            <Field label="Authority"><Input value={form.authority} onChange={(e) => setForm((f) => f && { ...f, authority: e.target.value })} /></Field>
            <Field label="Location"><Input value={form.location} onChange={(e) => setForm((f) => f && { ...f, location: e.target.value })} /></Field>
            <Field label="Tender Value (₹)"><Input type="number" value={form.tenderValue} onChange={(e) => setForm((f) => f && { ...f, tenderValue: e.target.value })} /></Field>
            <Field label="EMD (₹)"><Input type="number" value={form.emdAmount} onChange={(e) => setForm((f) => f && { ...f, emdAmount: e.target.value })} /></Field>
            <Field label="Tender Fee (₹)"><Input type="number" value={form.tenderFee} onChange={(e) => setForm((f) => f && { ...f, tenderFee: e.target.value })} /></Field>
            <Field label="Submission Date"><Input type="date" value={form.submissionDate} onChange={(e) => setForm((f) => f && { ...f, submissionDate: e.target.value })} /></Field>
            <Field label="Opening Date"><Input type="date" value={form.openingDate} onChange={(e) => setForm((f) => f && { ...f, openingDate: e.target.value })} /></Field>
            <Field label="Notes" className="col-span-3"><Textarea value={form.notes} onChange={(e) => setForm((f) => f && { ...f, notes: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        title="Delete this tender?"
        description="Moves it to Trash — an admin can restore it at any time."
        footer={
          <>
            <Button onClick={() => setTrashOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => void run(async () => {
                await trashTender(tender!, actor);
                setTrashOpen(false);
                router.push("/tenders");
              }, "Tender moved to Trash.")}
            >
              <Trash2 className="h-4 w-4" /> Move to Trash
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{tender.tenderCode} — {tender.title}</p>
      </Modal>
    </div>
  );
}

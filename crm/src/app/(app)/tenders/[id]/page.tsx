"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { deleteTender, subscribeTender, updateTender, updateTenderStatus } from "@/lib/db/tenders";
import { canManageTenders } from "@/lib/permissions";
import { TENDER_STATUSES, TENDER_STATUS_META, type TenderStatus } from "@/lib/constants";
import type { Tender } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

function dateInputValue(ts: Tender["submissionDate"]): string {
  const d = ts?.toDate?.();
  return d ? d.toISOString().slice(0, 10) : "";
}

export default function TenderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [tender, setTender] = useState<Tender | null | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [department, setDepartment] = useState("");
  const [authority, setAuthority] = useState("");
  const [location, setLocation] = useState("");
  const [tenderNumber, setTenderNumber] = useState("");
  const [tenderValue, setTenderValue] = useState("");
  const [emdAmount, setEmdAmount] = useState("");
  const [tenderFee, setTenderFee] = useState("");
  const [submissionDate, setSubmissionDate] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => subscribeTender(id, (row) => {
    setTender(row);
    if (row) {
      setTitle(row.title); setClientName(row.clientName);
      setDepartment(row.department ?? ""); setAuthority(row.authority ?? ""); setLocation(row.location ?? "");
      setTenderNumber(row.tenderNumber ?? "");
      setTenderValue(row.tenderValue != null ? String(row.tenderValue) : "");
      setEmdAmount(row.emdAmount != null ? String(row.emdAmount) : "");
      setTenderFee(row.tenderFee != null ? String(row.tenderFee) : "");
      setSubmissionDate(dateInputValue(row.submissionDate));
      setOpeningDate(dateInputValue(row.openingDate));
      setNotes(row.notes ?? "");
    }
  }), [id]);
  useDocumentTitle(tender ? `Tender · ${tender.tenderCode}` : undefined);

  const canEdit = canManageTenders(viewer);

  async function saveChanges() {
    if (!tender || !actor) return;
    await run(() => updateTender(tender, {
      title, clientName, department, authority, location, tenderNumber,
      tenderValue: tenderValue ? Number(tenderValue) : undefined,
      emdAmount: emdAmount ? Number(emdAmount) : undefined,
      tenderFee: tenderFee ? Number(tenderFee) : undefined,
      submissionDate: submissionDate ? new Date(submissionDate) : null,
      openingDate: openingDate ? new Date(openingDate) : null,
      notes,
    }, actor), "Tender updated.");
  }

  async function changeStatus(status: TenderStatus) {
    if (!tender || !actor) return;
    await run(() => updateTenderStatus(tender, status, actor), `Marked ${TENDER_STATUS_META[status].label}.`);
  }

  if (tender === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (tender === null) return <EmptyState title="Tender not found" />;

  return (
    <>
      <PageHeader
        title={tender.title}
        description={`${tender.tenderCode} · ${tender.clientName}`}
        actions={(
          <>
            {canEdit ? (
              <Select
                value={tender.status}
                onChange={(e) => void changeStatus(e.target.value as TenderStatus)}
                options={TENDER_STATUSES.map((s) => ({ value: s, label: TENDER_STATUS_META[s].label }))}
              />
            ) : (
              <Badge className={TENDER_STATUS_META[tender.status].className}>{TENDER_STATUS_META[tender.status].label}</Badge>
            )}
            {canEdit && (
              <Button onClick={() => setDeleteOpen(true)} className="text-rose-700 hover:bg-rose-50">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Tender details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required className="sm:col-span-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Client / Department name" required>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Tender number">
                <Input value={tenderNumber} onChange={(e) => setTenderNumber(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Department">
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Issuing authority">
                <Input value={authority} onChange={(e) => setAuthority(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Location" className="sm:col-span-2">
                <Input value={location} onChange={(e) => setLocation(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Tender value (₹)">
                <Input type="number" value={tenderValue} onChange={(e) => setTenderValue(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="EMD amount (₹)">
                <Input type="number" value={emdAmount} onChange={(e) => setEmdAmount(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Tender fee (₹)">
                <Input type="number" value={tenderFee} onChange={(e) => setTenderFee(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Submission date">
                <Input type="date" value={submissionDate} onChange={(e) => setSubmissionDate(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Opening date">
                <Input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} disabled={!canEdit} />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
              </Field>
            </div>

            <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-500">Created by</dt><dd className="text-ink-900">{tender.createdBy?.name ?? "—"} · {formatDateTime(tender.createdAt)}</dd></div>
            </dl>

            {canEdit && (
              <Button variant="primary" className="mt-4" loading={busy} onClick={() => void saveChanges()}>Save changes</Button>
            )}
          </Card>
        </div>

        <div>
          <Card title="Summary" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600">Tender value</dt><dd className="tabular-nums">{tender.tenderValue ? formatINR(tender.tenderValue) : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">EMD</dt><dd className="tabular-nums">{tender.emdAmount ? formatINR(tender.emdAmount) : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">Tender fee</dt><dd className="tabular-nums">{tender.tenderFee ? formatINR(tender.tenderFee) : "—"}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-1.5"><dt className="text-ink-600">Submission date</dt><dd>{tender.submissionDate ? formatDate(tender.submissionDate) : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">Opening date</dt><dd>{tender.openingDate ? formatDate(tender.openingDate) : "—"}</dd></div>
            </dl>
          </Card>

          <EntityActivityLog entityType="TENDER" entityId={tender.id} />
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this tender?"
        description="This permanently removes the tender. It cannot be recovered."
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await deleteTender(tender);
                  router.push("/tenders");
                }, "Tender deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete tender
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{tender.tenderCode} — {tender.title}</p>
      </Modal>
    </>
  );
}

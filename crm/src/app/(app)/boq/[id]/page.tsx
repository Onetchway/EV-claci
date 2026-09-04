"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GitBranch, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import { BoqItemsTable, type DraftBoqItem } from "@/components/boq-items-table";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  approveBoq, deleteBoq, reviseBoq, subscribeBoq, subscribeBoqLineage, updateBoq, updateBoqStatus,
} from "@/lib/db/boq";
import { canManageBoq } from "@/lib/permissions";
import { BOQ_STATUS_META, type BoqStatus } from "@/lib/constants";
import type { Boq, BoqLineItem } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export default function BoqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [boq, setBoq] = useState<Boq | null | undefined>(undefined);
  const [lineage, setLineage] = useState<Boq[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [approvalNote, setApprovalNote] = useState("");

  const [boqNo, setBoqNo] = useState("");
  const [siteName, setSiteName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftBoqItem[]>([]);

  useEffect(() => subscribeBoq(id, (row) => {
    setBoq(row);
    if (row) { setBoqNo(row.boqNo); setSiteName(row.siteName ?? ""); setNotes(row.notes ?? ""); setItems(row.items); }
  }), [id]);
  useEffect(() => {
    if (!boq) return;
    return subscribeBoqLineage(boq.rootBoqId ?? boq.id, setLineage);
  }, [boq?.rootBoqId, boq?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useDocumentTitle(boq ? `BOQ · ${boq.boqNo} (v${boq.version})` : undefined);

  const canEdit = canManageBoq(viewer);
  const isDraft = boq?.status === "DRAFT";
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * ((Number(it.supplyRate) || 0) + (Number(it.installationRate) || 0)), 0);

  async function saveChanges() {
    if (!boq || !actor) return;
    await run(() => updateBoq(boq, { boqNo, siteName, notes, items: items as BoqLineItem[] }, actor), "BOQ updated.");
  }

  async function changeStatus(status: BoqStatus) {
    if (!boq || !actor) return;
    await run(() => updateBoqStatus(boq, status, actor), `Marked ${BOQ_STATUS_META[status].label}.`);
  }

  async function submitApproval() {
    if (!boq || !actor) return;
    try {
      await approveBoq(boq, signatureName, approvalNote, actor);
      setApproveOpen(false);
      setSignatureName("");
      setApprovalNote("");
      push("BOQ approved.", "success");
    } catch (err) {
      push((err as Error).message, "error");
    }
  }

  async function onRevise() {
    if (!boq || !actor) return;
    await run(async () => {
      const { id: newId } = await reviseBoq(boq, actor);
      router.push(`/boq/${newId}`);
    }, "New revision created.");
  }

  if (boq === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (boq === null) return <EmptyState title="BOQ not found" />;

  return (
    <>
      <PageHeader
        title={`${boq.boqNo} — v${boq.version}`}
        description={boq.projectName}
        actions={(
          <>
            <Badge className={BOQ_STATUS_META[boq.status].className}>{BOQ_STATUS_META[boq.status].label}</Badge>
            {canEdit && isDraft && (
              <Button variant="primary" onClick={() => setApproveOpen(true)}>Approve</Button>
            )}
            {canEdit && boq.status === "APPROVED" && (
              <Button onClick={() => void onRevise()} loading={busy}><GitBranch className="h-4 w-4" /> Revise</Button>
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
          <Card title="BOQ details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="BOQ No."><Input value={boqNo} onChange={(e) => setBoqNo(e.target.value)} disabled={!canEdit || !isDraft} /></Field>
              <Field label="Site name"><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} disabled={!canEdit || !isDraft} /></Field>
              <Field label="Notes" className="sm:col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit || !isDraft} /></Field>
            </div>
            <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-500">Created by</dt><dd className="text-ink-900">{boq.createdBy?.name ?? "—"} · {formatDateTime(boq.createdAt)}</dd></div>
              <div><dt className="text-xs text-ink-500">BOQ date</dt><dd className="text-ink-900">{formatDate(boq.boqDate)}</dd></div>
              {boq.approval && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-ink-500">Approved</dt>
                  <dd className="text-ink-900">{boq.approval.approvedBy.name} · {formatDateTime(boq.approval.approvedAt)}{boq.approval.note ? ` — "${boq.approval.note}"` : ""}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Line items" subtitle={isDraft ? "Editable while this BOQ is a draft." : "Locked — approved, or use Revise to open a new draft."}>
            <BoqItemsTable items={items} onChange={(next) => setItems(next)} disabled={!canEdit || !isDraft} />
          </Card>

          {canEdit && isDraft && (
            <Button variant="primary" loading={busy} onClick={() => void saveChanges()}>Save changes</Button>
          )}
        </div>

        <div>
          <Card title="Summary" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between border-t border-ink-200 pt-1.5 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(total)}</dd></div>
            </dl>
            {canEdit && boq.status !== "DRAFT" && (
              <Button className="mt-3 w-full justify-center" onClick={() => void changeStatus("DRAFT")}>Reopen as draft</Button>
            )}
          </Card>

          {lineage.length > 1 && (
            <Card title="Version history">
              <ul className="space-y-1.5 text-sm">
                {lineage.map((v) => (
                  <li key={v.id} className="flex items-center justify-between">
                    <a href={`/boq/${v.id}`} className={v.id === boq.id ? "font-semibold text-navy-900" : "text-brand-700 hover:underline"}>
                      v{v.version}{v.id === boq.id ? " (current)" : ""}
                    </a>
                    <Badge className={BOQ_STATUS_META[v.status].className}>{BOQ_STATUS_META[v.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <EntityActivityLog entityType="BOQ" entityId={boq.id} />
        </div>
      </div>

      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve this BOQ?"
        description="Type your name exactly as shown to confirm — this is an internal sign-off, not a cryptographic signature."
        footer={(
          <>
            <Button onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void submitApproval()}>Confirm approval</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label={`Type "${actor?.name ?? ""}" to confirm`} required>
            <Input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
          </Field>
          <Field label="Note (optional)"><Textarea value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} /></Field>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this BOQ?"
        description="This permanently removes the BOQ. It cannot be recovered."
        footer={(
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!actor) return;
                  await deleteBoq(boq, actor);
                  router.push("/boq");
                }, "BOQ deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete BOQ
            </Button>
          </>
        )}
      >
        <p className="text-sm text-ink-700">{boq.boqNo} — v{boq.version}, {formatINR(boq.totalAmount)}</p>
      </Modal>
    </>
  );
}

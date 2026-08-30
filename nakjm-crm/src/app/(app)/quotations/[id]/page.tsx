"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Printer, ShieldCheck, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { EntityDocuments } from "@/components/entity-documents";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAsyncAction } from "@/components/ui";
import { QUOTATION_STATUSES, type QuotationStatus } from "@/lib/constants";
import { getClient } from "@/lib/db/clients";
import { approveQuotation, deleteQuotation, subscribeQuotation, updateQuotationStatus } from "@/lib/db/quotations";
import { canManageProcurement, canTrash } from "@/lib/permissions";
import type { Client, Quotation } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

const NON_APPROVAL_STATUSES = QUOTATION_STATUSES.filter((s) => s !== "APPROVED");

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [q, setQ] = useState<Quotation | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [approvalNote, setApprovalNote] = useState("");

  useEffect(() => subscribeQuotation(id, setQ), [id]);
  useEffect(() => { if (q?.clientId) void getClient(q.clientId).then(setClient); }, [q?.clientId]);

  if (q === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (q === null) return <EmptyState title="Quotation not found" action={<Link href="/quotations"><Button>Back to quotations</Button></Link>} />;

  async function onStatusChange(status: QuotationStatus) {
    await run(() => updateQuotationStatus(q!.id, status, actor, { quotationNo: q!.quotationNo, projectId: q!.projectId }), `Marked ${status}.`);
  }

  async function onApprove() {
    await run(async () => {
      await approveQuotation(q!, signatureName, approvalNote, actor);
      setApproveOpen(false);
      setSignatureName("");
      setApprovalNote("");
    }, "Quotation approved.");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={q.quotationNo}
        description={`${client?.name ?? "—"} · v${q.version}`}
        actions={
          <>
            {canManageProcurement(viewer) ? (
              <Select
                value={q.status}
                options={(q.status === "APPROVED" ? QUOTATION_STATUSES : NON_APPROVAL_STATUSES).map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
                onChange={(e) => void onStatusChange(e.target.value as QuotationStatus)}
              />
            ) : (
              <Badge>{q.status.replace(/_/g, " ")}</Badge>
            )}
            {canManageProcurement(viewer) && q.status !== "APPROVED" && (
              <Button variant="primary" onClick={() => setApproveOpen(true)}><ShieldCheck className="h-4 w-4" /> Approve</Button>
            )}
            <Link href={`/projects/${q.projectId}/quotations/${q.id}/print`}>
              <Button><Printer className="h-4 w-4" /> Print / PDF</Button>
            </Link>
            {canTrash(viewer) && (
              <Button className="text-rose-700 hover:bg-rose-50" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Line items">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="pb-2">Description</th>
                    <th className="pb-2">HSN/SAC</th>
                    <th className="pb-2">Unit</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {q.items.map((line) => (
                    <tr key={line.srNo} className="border-b border-ink-100">
                      <td className="py-2">{line.description}</td>
                      <td className="py-2 text-ink-500">{line.hsnCode || "—"}</td>
                      <td className="py-2 text-ink-500">{line.unit || "—"}</td>
                      <td className="py-2 text-right tabular-nums">{line.qty}</td>
                      <td className="py-2 text-right tabular-nums">{formatINR(line.rate)}</td>
                      <td className="py-2 text-right tabular-nums">{formatINR(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <dl className="w-56 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-ink-600">Subtotal</dt><dd className="tabular-nums">{formatINR(q.subtotal)}</dd></div>
                {q.gstType === "CGST_SGST" ? (
                  <>
                    <div className="flex justify-between"><dt className="text-ink-600">CGST</dt><dd className="tabular-nums">{formatINR(q.cgstAmount ?? 0)}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-600">SGST</dt><dd className="tabular-nums">{formatINR(q.sgstAmount ?? 0)}</dd></div>
                  </>
                ) : (
                  <div className="flex justify-between"><dt className="text-ink-600">IGST ({q.taxPercent}%)</dt><dd className="tabular-nums">{formatINR(q.igstAmount ?? q.taxAmount)}</dd></div>
                )}
                <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(q.totalAmount)}</dd></div>
              </dl>
            </div>
          </Card>

          {q.shipToDifferent && q.shipToAddress && (
            <Card title="Ship to"><p className="whitespace-pre-line text-sm text-ink-700">{q.shipToAddress}</p></Card>
          )}
          {q.terms && (
            <Card title="Terms &amp; conditions"><p className="whitespace-pre-line text-sm text-ink-700">{q.terms}</p></Card>
          )}
          {q.notes && (
            <Card title="Notes"><p className="whitespace-pre-line text-sm text-ink-700">{q.notes}</p></Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Client</dt><dd>{client ? <Link href={`/clients/${client.id}`} className="text-brand-700 hover:underline">{client.name}</Link> : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Project</dt><dd><Link href={`/projects/${q.projectId}`} className="text-brand-700 hover:underline">{q.projectName}</Link></dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Quotation date</dt><dd>{formatDate(q.quotationDate)}</dd></div>
              {q.validUntil && <div className="flex justify-between"><dt className="text-ink-500">Valid until</dt><dd>{formatDate(q.validUntil)}</dd></div>}
            </dl>
          </Card>

          {q.approval && (
            <Card title="Approval">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-500">Approved by</dt><dd>{q.approval.approvedBy.name}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">Signed</dt><dd>{q.approval.signatureName}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">Date</dt><dd>{formatDateTime(q.approval.approvedAt)}</dd></div>
              </dl>
              {q.approval.note && <p className="mt-2 border-t border-ink-100 pt-2 text-sm text-ink-700">{q.approval.note}</p>}
            </Card>
          )}

          <EntityDocuments projectId={q.projectId} entityType="QUOTATION" entityId={q.id} defaultDocType="QUOTATION_UPLOAD" title="Quotation Documents" />

          <EntityActivityLog entityType="QUOTATION" entityId={q.id} />
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this quotation?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { await deleteQuotation(q!, actor); router.push("/quotations"); }, "Quotation deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        <p className="text-sm text-ink-700">{q.quotationNo}</p>
      </Modal>

      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve this quotation"
        description={`Type your name exactly as shown ("${actor.name}") to confirm approval — this is recorded as your sign-off.`}
        footer={<><Button variant="secondary" onClick={() => setApproveOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => void onApprove()}><ShieldCheck className="h-4 w-4" /> Confirm Approval</Button></>}
      >
        <div className="space-y-3">
          <Field label="Your name" required hint={`Type: ${actor.name}`}>
            <Input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
          </Field>
          <Field label="Note (optional)"><Textarea value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}

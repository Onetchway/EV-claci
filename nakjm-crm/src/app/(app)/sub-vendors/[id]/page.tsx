"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Layers, Pencil, Plus, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { EntityDocuments } from "@/components/entity-documents";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Select, Spinner, useAsyncAction } from "@/components/ui";
import {
  STAGE_STATUS_META, SUB_VENDOR_CONTRACT_STATUSES, SUB_VENDOR_CONTRACT_STATUS_META,
  SUB_VENDOR_PAYMENT_STATUS_META, type SubVendorContractStatus,
} from "@/lib/constants";
import { subscribePurchaseOrders } from "@/lib/db/purchase-orders";
import { deleteSubVendorContract, subscribeSubVendorContract, updateSubVendorContract } from "@/lib/db/sub-vendors";
import { canManageProcurement, canTrash } from "@/lib/permissions";
import type { PurchaseOrder, SubVendorContract } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function SubVendorContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [contract, setContract] = useState<SubVendorContract | null | undefined>(undefined);
  const [pos, setPos] = useState<PurchaseOrder[] | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => subscribeSubVendorContract(id, setContract), [id]);
  useEffect(() => subscribePurchaseOrders(setPos), []);

  const linkedPos = useMemo(
    () => (pos ?? []).filter((po) => po.projectId === contract?.projectId && po.vendorId === contract?.vendorId),
    [pos, contract?.projectId, contract?.vendorId],
  );

  if (contract === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (contract === null) return <EmptyState title="Sub-vendor contract not found" action={<Link href="/sub-vendors"><Button>Back to sub-vendor contracts</Button></Link>} />;

  async function onStatusChange(status: SubVendorContractStatus) {
    await run(() => updateSubVendorContract(contract!, { status }, actor), `Marked ${SUB_VENDOR_CONTRACT_STATUS_META[status].label}.`);
  }

  const paidSoFar = linkedPos.reduce((s, po) => s + po.paidAmount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={contract.contractNo}
        description={`${contract.vendorName} — ${contract.projectName}`}
        actions={
          <>
            {canManageProcurement(viewer) ? (
              <Select
                value={contract.status}
                options={SUB_VENDOR_CONTRACT_STATUSES.map((s) => ({ value: s, label: SUB_VENDOR_CONTRACT_STATUS_META[s].label }))}
                onChange={(e) => void onStatusChange(e.target.value as SubVendorContractStatus)}
              />
            ) : (
              <Badge className={SUB_VENDOR_CONTRACT_STATUS_META[contract.status].className}>{SUB_VENDOR_CONTRACT_STATUS_META[contract.status].label}</Badge>
            )}
            {canManageProcurement(viewer) && (
              <Link href={`/sub-vendors/${contract.id}/edit`}><Button><Pencil className="h-4 w-4" /> Edit</Button></Link>
            )}
            {canTrash(viewer) && (
              <Button className="text-rose-700 hover:bg-rose-50" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Contract details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div><dt className="text-ink-500">Project / Sub-project</dt><dd><Link href={`/projects/${contract.projectId}`} className="text-brand-700 hover:underline">{contract.projectName}</Link></dd></div>
              <div><dt className="text-ink-500">Sub-vendor</dt><dd><Link href={`/vendors/${contract.vendorId}`} className="text-brand-700 hover:underline">{contract.vendorName}</Link></dd></div>
              <div><dt className="text-ink-500">Contract value</dt><dd className="tabular-nums">{formatINR(contract.contractValue)}</dd></div>
              <div><dt className="text-ink-500">Start date</dt><dd>{formatDate(contract.startDate)}</dd></div>
              <div><dt className="text-ink-500">Deadline</dt><dd>{formatDate(contract.targetEndDate)}</dd></div>
              {contract.scopeOfWork && <div className="col-span-2"><dt className="text-ink-500">Scope of work</dt><dd className="whitespace-pre-line">{contract.scopeOfWork}</dd></div>}
            </dl>
          </Card>

          <Card title="Stages & timeline" subtitle={`${contract.stages.length} ${contract.stages.length === 1 ? "stage" : "stages"}`}>
            {contract.stages.length === 0 ? (
              <p className="text-sm text-ink-400">No stages added yet. Click Edit to add.</p>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500"><th className="pb-2 pr-3">Stage</th><th className="pb-2 px-3">Start</th><th className="pb-2 px-3">Deadline</th><th className="pb-2 px-3 text-right">Amount</th><th className="pb-2 pl-3">Status</th></tr></thead>
                  <tbody>
                    {contract.stages.map((s, i) => (
                      <tr key={i} className="border-b border-ink-100">
                        <td className="py-2 pr-3">{s.name || "—"}</td>
                        <td className="py-2 px-3 text-ink-600">{formatDate(s.startDate)}</td>
                        <td className="py-2 px-3 text-ink-600">{formatDate(s.endDate)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{s.amount ? formatINR(s.amount) : "—"}</td>
                        <td className="py-2 pl-3"><Badge className={STAGE_STATUS_META[s.status].className}>{STAGE_STATUS_META[s.status].label}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Payment terms" subtitle={`${contract.paymentTerms.length} ${contract.paymentTerms.length === 1 ? "term" : "terms"}`}>
            {contract.paymentTerms.length === 0 ? (
              <p className="text-sm text-ink-400">No payment terms added yet. Click Edit to add.</p>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500"><th className="pb-2 pr-3">Milestone</th><th className="pb-2 px-3 text-right">%</th><th className="pb-2 px-3 text-right">Amount</th><th className="pb-2 pl-3">Status</th></tr></thead>
                  <tbody>
                    {contract.paymentTerms.map((t, i) => (
                      <tr key={i} className="border-b border-ink-100">
                        <td className="py-2 pr-3">{t.milestone || "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{t.percent ? `${t.percent}%` : "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{t.amount ? formatINR(t.amount) : "—"}</td>
                        <td className="py-2 pl-3"><Badge className={SUB_VENDOR_PAYMENT_STATUS_META[t.status].className}>{SUB_VENDOR_PAYMENT_STATUS_META[t.status].label}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {(contract.penaltyClause || contract.penaltyAmount) && (
            <Card title="Penalty clause">
              {contract.penaltyClause && <p className="whitespace-pre-line text-sm text-ink-700">{contract.penaltyClause}</p>}
              <dl className="mt-2 flex gap-6 text-sm">
                {!!contract.penaltyAmount && <div><dt className="text-ink-500">Penalty amount</dt><dd className="tabular-nums">{formatINR(contract.penaltyAmount)}</dd></div>}
                {!!contract.penaltyTimelineDays && <div><dt className="text-ink-500">Grace period</dt><dd>{contract.penaltyTimelineDays} days</dd></div>}
              </dl>
            </Card>
          )}

          {contract.terms && <Card title="Terms &amp; conditions"><p className="whitespace-pre-line text-sm text-ink-700">{contract.terms}</p></Card>}
          {contract.notes && <Card title="Notes"><p className="whitespace-pre-line text-sm text-ink-700">{contract.notes}</p></Card>}

          <Card
            title="Purchase Orders raised to this sub-vendor"
            subtitle={`${linkedPos.length} ${linkedPos.length === 1 ? "PO" : "POs"} on this project`}
            actions={
              canManageProcurement(viewer) ? (
                <Link href={`/purchase-orders/new?projectId=${contract.projectId}&vendorId=${contract.vendorId}`}>
                  <Button size="sm"><Plus className="h-3.5 w-3.5" /> Raise PO</Button>
                </Link>
              ) : undefined
            }
          >
            {linkedPos.length === 0 ? (
              <p className="text-sm text-ink-400">No POs raised to this sub-vendor on this project yet.</p>
            ) : (
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500"><th className="pb-2 pr-3">No.</th><th className="pb-2 px-3">Status</th><th className="pb-2 px-3 text-right">Total</th><th className="pb-2 pl-3 text-right">Paid</th></tr></thead>
                  <tbody>
                    {linkedPos.map((po) => (
                      <tr key={po.id} className="border-b border-ink-100">
                        <td className="py-2 pr-3"><Link href={`/purchase-orders/${po.id}`} className="text-brand-700 hover:underline">{po.poNo}</Link></td>
                        <td className="py-2 px-3"><Badge>{po.status.replace(/_/g, " ")}</Badge></td>
                        <td className="py-2 px-3 text-right tabular-nums">{formatINR(po.totalAmount)}</td>
                        <td className="py-2 pl-3 text-right tabular-nums text-emerald-600">{formatINR(po.paidAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
              <Link href={`/projects/${contract.projectId}?tab=Quotations`}><Button variant="secondary" size="sm"><FileSpreadsheet className="h-3.5 w-3.5" /> Project Quotations</Button></Link>
              <Link href={`/projects/${contract.projectId}?tab=BOQ`}><Button variant="secondary" size="sm"><Layers className="h-3.5 w-3.5" /> Project BOQ</Button></Link>
              <Link href={`/projects/${contract.projectId}?tab=Proforma+Invoices`}><Button variant="secondary" size="sm"><FileText className="h-3.5 w-3.5" /> Project PIs</Button></Link>
            </div>
          </Card>

          <EntityDocuments projectId={contract.projectId} entityType="SUB_VENDOR_CONTRACT" entityId={contract.id} defaultDocType="OTHER" title="Contract Documents" />
        </div>

        <div className="space-y-4">
          <Card title="Payment summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600">Contract value</dt><dd className="font-medium tabular-nums">{formatINR(contract.contractValue)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">Paid via POs</dt><dd className="tabular-nums text-emerald-600">{formatINR(paidSoFar)}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-2 font-semibold"><dt>Due</dt><dd className="tabular-nums text-rose-600">{formatINR(Math.max(contract.contractValue - paidSoFar, 0))}</dd></div>
            </dl>
          </Card>

          <EntityActivityLog entityType="SUB_VENDOR_CONTRACT" entityId={contract.id} />
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this sub-vendor contract?"
        description="This cannot be undone. Any POs already raised to this vendor are not affected."
        footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { await deleteSubVendorContract(contract!, actor); router.push("/sub-vendors"); }, "Sub-vendor contract deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        <p className="text-sm text-ink-700">{contract.contractNo} — {contract.vendorName}</p>
      </Modal>
    </div>
  );
}

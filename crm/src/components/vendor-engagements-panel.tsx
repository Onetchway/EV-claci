"use client";

/**
 * "Work Engagements" tab/section on the vendor detail page — the sub-vendor
 * job-tracking feature (milestones/stages, payment terms, PO/PI/Quotation/BOQ
 * references, penalty clause, overall timeline) requested for Vendors. Lives
 * here rather than as new top-level nav because a vendor engagement only
 * ever makes sense in the context of one vendor, and Vendors already sits
 * alongside Project Management in the Operations nav group — see the doc
 * comment on VendorEngagement in lib/types.ts for the full reasoning.
 */

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Plus, Trash2 } from "lucide-react";

import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import {
  TASK_STATUSES, TASK_STATUS_COLOR, TASK_STATUS_LABEL,
  VENDOR_ENGAGEMENT_STATUSES, VENDOR_ENGAGEMENT_STATUS_COLOR, VENDOR_ENGAGEMENT_STATUS_LABEL,
  type TaskStatus, type VendorEngagementStatus,
} from "@/lib/constants";
import {
  createVendorEngagement, deleteVendorEngagement, saveEngagementMilestones,
  subscribeVendorEngagements, updateVendorEngagement, type VendorEngagementDraft,
} from "@/lib/db/vendor-engagements";
import { subscribeProjects } from "@/lib/db/projects";
import { subscribePurchaseOrders } from "@/lib/db/purchase-orders";
import { subscribeProformaInvoices } from "@/lib/db/proforma-invoices";
import { subscribeQuotations } from "@/lib/db/quotations";
import { canManageVendors } from "@/lib/permissions";
import type { Viewer } from "@/lib/permissions";
import type {
  Actor, ProformaInvoice, Project, PurchaseOrder, Quotation, Vendor, VendorEngagement, VendorEngagementMilestone,
} from "@/lib/types";
import { cn, formatDate, formatINR, toDate } from "@/lib/utils";

const toInput = (d: unknown) => {
  const date = toDate(d as never);
  return date ? date.toISOString().slice(0, 10) : "";
};
const fromInput = (s: string) => (s ? new Date(`${s}T00:00:00`) : null);

const blankDraft = (vendor: Vendor): VendorEngagementDraft => ({
  vendorId: vendor.id,
  vendorName: vendor.name,
  title: "",
  description: "",
  status: "DRAFT",
  linkedProjectId: null, linkedProjectCode: null,
  linkedPoId: null, linkedPoNumber: null,
  linkedPiId: null, linkedPiNumber: null,
  linkedQuotationId: null, linkedQuotationNumber: null,
  boqReference: "",
  paymentTerms: vendor.paymentTerms ?? "",
  totalAmount: 0,
  penaltyClause: "",
  penaltyAppliedAmount: 0,
  targetCompletionAt: null,
  actualCompletionAt: null,
});

let milestoneSeq = 0;
const blankMilestone = (): VendorEngagementMilestone => ({
  id: `ms${Date.now()}${milestoneSeq++}`, label: "", status: "NOT_STARTED", amount: 0,
});

export function VendorEngagementsPanel({
  vendor, viewer, actor, className,
}: {
  vendor: Vendor;
  viewer: Viewer;
  actor: Actor | null;
  className?: string;
}) {
  const canEdit = canManageVendors(viewer);
  const [rows, setRows] = useState<VendorEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [pis, setPis] = useState<ProformaInvoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VendorEngagement | null>(null);
  const [draft, setDraft] = useState<VendorEngagementDraft>(() => blankDraft(vendor));
  const [milestones, setMilestones] = useState<VendorEngagementMilestone[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<VendorEngagement | null>(null);
  const { busy, run } = useAsyncAction();

  useEffect(() => subscribeVendorEngagements(vendor.id, (r) => { setRows(r); setLoading(false); }, () => setLoading(false)), [vendor.id]);
  useEffect(() => subscribeProjects({ max: 500 }, setProjects), []);
  useEffect(() => subscribePurchaseOrders({ vendorId: vendor.id }, setPos), [vendor.id]);
  useEffect(() => subscribeProformaInvoices({}, setPis), []);
  useEffect(() => subscribeQuotations({}, setQuotations), []);

  function openCreate() {
    setEditing(null);
    setDraft(blankDraft(vendor));
    setMilestones([]);
    setFormOpen(true);
  }

  function openEdit(row: VendorEngagement) {
    setEditing(row);
    setDraft({
      vendorId: row.vendorId, vendorName: row.vendorName, title: row.title, description: row.description ?? "",
      status: row.status,
      linkedProjectId: row.linkedProjectId ?? null, linkedProjectCode: row.linkedProjectCode ?? null,
      linkedPoId: row.linkedPoId ?? null, linkedPoNumber: row.linkedPoNumber ?? null,
      linkedPiId: row.linkedPiId ?? null, linkedPiNumber: row.linkedPiNumber ?? null,
      linkedQuotationId: row.linkedQuotationId ?? null, linkedQuotationNumber: row.linkedQuotationNumber ?? null,
      boqReference: row.boqReference ?? "",
      paymentTerms: row.paymentTerms ?? "",
      totalAmount: row.totalAmount ?? 0,
      penaltyClause: row.penaltyClause ?? "",
      penaltyAppliedAmount: row.penaltyAppliedAmount ?? 0,
      targetCompletionAt: toDate(row.targetCompletionAt),
      actualCompletionAt: toDate(row.actualCompletionAt),
    });
    setMilestones(row.milestones ?? []);
    setFormOpen(true);
  }

  const milestoneTotal = useMemo(() => milestones.reduce((a, m) => a + (m.amount ?? 0), 0), [milestones]);

  async function submit() {
    if (!actor || !draft.title.trim()) throw new Error("Give this engagement a title first.");
    if (editing) {
      await updateVendorEngagement(editing, draft, actor);
      await saveEngagementMilestones(editing, milestones, actor);
    } else {
      const { id, number } = await createVendorEngagement(draft, actor);
      if (milestones.length) await saveEngagementMilestones({ id, number }, milestones, actor);
    }
    setFormOpen(false);
  }

  return (
    <Card
      title="Work engagements"
      subtitle={`${rows.length} engagement${rows.length === 1 ? "" : "s"}`}
      className={className}
      actions={canEdit && <Button size="sm" variant="primary" onClick={openCreate}><Plus className="h-4 w-4" /> New engagement</Button>}
    >
      {loading ? (
        <div className="flex justify-center py-10 text-ink-400"><Spinner className="h-6 w-6" /></div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-8 w-8" />}
          title="No work engagements yet"
          description="Track a specific job assigned to this vendor — milestones, payment terms, linked PO/PI/Quotation, penalty clause and timeline."
          action={canEdit ? <Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" /> New engagement</Button> : undefined}
        />
      ) : (
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full">
            <thead className="border-b border-ink-200">
              <tr>
                <th className="th">Number</th>
                <th className="th">Title</th>
                <th className="th">Status</th>
                <th className="th">Project</th>
                <th className="th text-right">Amount</th>
                <th className="th">Target completion</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink-50">
                  <td className="td font-medium text-ink-900">{r.number}</td>
                  <td className="td">{r.title}</td>
                  <td className="td"><Badge className={VENDOR_ENGAGEMENT_STATUS_COLOR[r.status]}>{VENDOR_ENGAGEMENT_STATUS_LABEL[r.status]}</Badge></td>
                  <td className="td text-ink-600">{r.linkedProjectCode || "—"}</td>
                  <td className="td text-right font-medium tabular-nums">{formatINR(r.totalAmount)}</td>
                  <td className="td text-ink-500">{r.targetCompletionAt ? formatDate(r.targetCompletionAt) : "—"}</td>
                  <td className="td text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" onClick={() => openEdit(r)}>Edit</Button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Delete engagement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this engagement"
        description="This permanently removes the engagement and its milestones. This can't be undone."
        footer={
          <>
            <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!actor || !deleteTarget) return;
                  await deleteVendorEngagement(deleteTarget, actor);
                  setDeleteTarget(null);
                }, "Engagement deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      >
        {deleteTarget && <p className="text-sm text-ink-700">{deleteTarget.number} — {deleteTarget.title}</p>}
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.number}` : "New work engagement"}
        description={`${vendor.name} (${vendor.code})`}
        wide
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void run(submit, editing ? "Engagement updated." : "Engagement created.")}>
              {editing ? "Save changes" : "Create engagement"}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2" hint="What the work is, e.g. civil + electrical work for a station.">
            <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as VendorEngagementStatus }))}
              options={VENDOR_ENGAGEMENT_STATUSES.map((s) => ({ value: s, label: VENDOR_ENGAGEMENT_STATUS_LABEL[s] }))}
            />
          </Field>
          <Field label="Total amount (₹)">
            <Input
              type="number" min={0}
              value={draft.totalAmount ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, totalAmount: Number(e.target.value) || 0 }))}
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
          </Field>

          <Field label="Linked project" hint="Which station this work is for.">
            <Select
              value={draft.linkedProjectId ?? ""}
              onChange={(e) => {
                const p = projects.find((x) => x.id === e.target.value);
                setDraft((d) => ({ ...d, linkedProjectId: p?.id ?? null, linkedProjectCode: p?.code ?? null }));
              }}
              options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))]}
            />
          </Field>
          <Field label="Linked purchase order">
            <Select
              value={draft.linkedPoId ?? ""}
              onChange={(e) => {
                const po = pos.find((x) => x.id === e.target.value);
                setDraft((d) => ({ ...d, linkedPoId: po?.id ?? null, linkedPoNumber: po?.poNumber ?? null }));
              }}
              options={[{ value: "", label: "None" }, ...pos.map((p) => ({ value: p.id, label: p.poNumber }))]}
            />
          </Field>
          <Field label="Linked proforma invoice">
            <Select
              value={draft.linkedPiId ?? ""}
              onChange={(e) => {
                const pi = pis.find((x) => x.id === e.target.value);
                setDraft((d) => ({ ...d, linkedPiId: pi?.id ?? null, linkedPiNumber: pi?.piNumber ?? null }));
              }}
              options={[{ value: "", label: "None" }, ...pis.map((p) => ({ value: p.id, label: p.piNumber }))]}
            />
          </Field>
          <Field label="Linked quotation">
            <Select
              value={draft.linkedQuotationId ?? ""}
              onChange={(e) => {
                const q = quotations.find((x) => x.id === e.target.value);
                setDraft((d) => ({ ...d, linkedQuotationId: q?.id ?? null, linkedQuotationNumber: q?.quoteNumber ?? null }));
              }}
              options={[{ value: "", label: "None" }, ...quotations.map((q) => ({ value: q.id, label: q.quoteNumber }))]}
            />
          </Field>
          <Field label="BOQ reference" className="sm:col-span-2" hint="Document number or note — no separate BOQ module exists yet.">
            <Input value={draft.boqReference ?? ""} onChange={(e) => setDraft((d) => ({ ...d, boqReference: e.target.value }))} />
          </Field>

          <Field label="Payment terms" className="sm:col-span-2" hint="Prefilled from the vendor's default terms — edit freely for this engagement.">
            <Textarea rows={2} value={draft.paymentTerms ?? ""} onChange={(e) => setDraft((d) => ({ ...d, paymentTerms: e.target.value }))} />
          </Field>

          <Field label="Target completion">
            <Input type="date" value={toInput(draft.targetCompletionAt)} onChange={(e) => setDraft((d) => ({ ...d, targetCompletionAt: fromInput(e.target.value) }))} />
          </Field>
          <Field label="Actual completion">
            <Input type="date" value={toInput(draft.actualCompletionAt)} onChange={(e) => setDraft((d) => ({ ...d, actualCompletionAt: fromInput(e.target.value) }))} />
          </Field>

          <Field label="Penalty clause" className="sm:col-span-2" hint="Describe the terms, e.g. 1% of order value per week of delay.">
            <Textarea rows={2} value={draft.penaltyClause ?? ""} onChange={(e) => setDraft((d) => ({ ...d, penaltyClause: e.target.value }))} />
          </Field>
          <Field label="Penalty applied (₹)" hint="Only set once actually enforced.">
            <Input
              type="number" min={0}
              value={draft.penaltyAppliedAmount ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, penaltyAppliedAmount: Number(e.target.value) || 0 }))}
            />
          </Field>

          <div className="sm:col-span-2 border-t border-ink-100 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="label">Milestones / stages</p>
              <Button size="sm" type="button" onClick={() => setMilestones((m) => [...m, blankMilestone()])}>
                <Plus className="h-3.5 w-3.5" /> Add milestone
              </Button>
            </div>
            {milestones.length === 0 ? (
              <p className="text-xs text-ink-400">No milestones yet.</p>
            ) : (
              <div className="space-y-3">
                {milestones.map((m) => (
                  <div key={m.id} className="rounded-lg border border-ink-200 p-3">
                    <div className="grid gap-2 sm:grid-cols-6">
                      <Input
                        className="sm:col-span-2"
                        placeholder="Milestone label"
                        value={m.label}
                        onChange={(e) => setMilestones((rows) => rows.map((r) => (r.id === m.id ? { ...r, label: e.target.value } : r)))}
                      />
                      <Select
                        value={m.status}
                        onChange={(e) => setMilestones((rows) => rows.map((r) => (r.id === m.id ? { ...r, status: e.target.value as TaskStatus } : r)))}
                        options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }))}
                      />
                      <Input
                        type="date"
                        title="Planned start"
                        value={toInput(m.plannedStart)}
                        onChange={(e) => setMilestones((rows) => rows.map((r) => (r.id === m.id ? { ...r, plannedStart: fromInput(e.target.value) as never } : r)))}
                      />
                      <Input
                        type="date"
                        title="Planned end"
                        value={toInput(m.plannedEnd)}
                        onChange={(e) => setMilestones((rows) => rows.map((r) => (r.id === m.id ? { ...r, plannedEnd: fromInput(e.target.value) as never } : r)))}
                      />
                      <Input
                        type="number"
                        min={0}
                        placeholder="Amount"
                        value={m.amount ?? 0}
                        onChange={(e) => setMilestones((rows) => rows.map((r) => (r.id === m.id ? { ...r, amount: Number(e.target.value) || 0 } : r)))}
                      />
                      <button
                        type="button"
                        onClick={() => setMilestones((rows) => rows.filter((r) => r.id !== m.id))}
                        className="justify-self-end rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600 sm:col-span-6 sm:w-fit"
                        aria-label="Remove milestone"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <Input
                        type="date"
                        title="Actual start"
                        value={toInput(m.actualStart)}
                        onChange={(e) => setMilestones((rows) => rows.map((r) => (r.id === m.id ? { ...r, actualStart: fromInput(e.target.value) as never } : r)))}
                      />
                      <Input
                        type="date"
                        title="Actual end"
                        value={toInput(m.actualEnd)}
                        onChange={(e) => setMilestones((rows) => rows.map((r) => (r.id === m.id ? { ...r, actualEnd: fromInput(e.target.value) as never } : r)))}
                      />
                      <Input
                        placeholder="Note"
                        value={m.note ?? ""}
                        onChange={(e) => setMilestones((rows) => rows.map((r) => (r.id === m.id ? { ...r, note: e.target.value } : r)))}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-right text-xs text-ink-500">Milestone total: <span className={cn("font-semibold", milestoneTotal !== (draft.totalAmount ?? 0) && "text-amber-600")}>{formatINR(milestoneTotal)}</span></p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </Card>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAsyncAction,
} from "@/components/ui";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  addMilestone, subscribeVendorAssignment, trashVendorAssignment, updateAssignmentStatus,
  updateMilestoneStatus, updateVendorAssignment, type MilestoneDraft,
} from "@/lib/db/vendor-assignments";
import { canManageVendorAssignments } from "@/lib/permissions";
import {
  ASSIGNMENT_STATUSES, ASSIGNMENT_STATUS_META, MILESTONE_STATUSES, MILESTONE_STATUS_META, type AssignmentStatus, type MilestoneStatus,
} from "@/lib/constants";
import type { VendorAssignment } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

export default function VendorAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [assignment, setAssignment] = useState<VendorAssignment | null | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [newMilestone, setNewMilestone] = useState<MilestoneDraft>({ name: "", dueDate: null, amount: undefined });

  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [penaltyClause, setPenaltyClause] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => subscribeVendorAssignment(id, (row) => {
    setAssignment(row);
    if (row) {
      setTitle(row.title); setScope(row.scope ?? ""); setContractAmount(String(row.contractAmount));
      setPaymentTerms(row.paymentTerms ?? ""); setPenaltyClause(row.penaltyClause ?? ""); setNotes(row.notes ?? "");
    }
  }), [id]);
  useDocumentTitle(assignment ? `Assignment · ${assignment.assignmentNo}` : undefined);

  const canEdit = canManageVendorAssignments(viewer);

  async function saveChanges() {
    if (!assignment || !actor) return;
    await run(() => updateVendorAssignment(assignment, {
      title, scope, contractAmount: Number(contractAmount) || 0, paymentTerms, penaltyClause, notes,
    }, actor), "Assignment updated.");
  }

  async function changeStatus(status: AssignmentStatus) {
    if (!assignment || !actor) return;
    await run(() => updateAssignmentStatus(assignment, status, actor), `Marked ${ASSIGNMENT_STATUS_META[status].label}.`);
  }

  async function changeMilestoneStatus(milestoneId: string, status: MilestoneStatus) {
    if (!assignment || !actor) return;
    await updateMilestoneStatus(assignment, milestoneId, status, actor);
  }

  async function submitMilestone() {
    if (!assignment || !actor || !newMilestone.name.trim()) return;
    await run(async () => {
      await addMilestone(assignment, newMilestone, actor);
      setAddMilestoneOpen(false);
      setNewMilestone({ name: "", dueDate: null, amount: undefined });
    }, "Milestone added.");
  }

  if (assignment === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (assignment === null) return <EmptyState title="Assignment not found" />;

  const milestoneTotal = assignment.milestones.reduce((s, m) => s + (m.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title={assignment.title}
        description={`${assignment.assignmentNo} · ${assignment.vendorName}${assignment.parentVendorName ? ` (sub-vendor of ${assignment.parentVendorName})` : ""} · ${assignment.projectName}`}
        actions={(
          <>
            {canEdit ? (
              <Select
                value={assignment.status}
                onChange={(e) => void changeStatus(e.target.value as AssignmentStatus)}
                options={ASSIGNMENT_STATUSES.map((s) => ({ value: s, label: ASSIGNMENT_STATUS_META[s].label }))}
              />
            ) : (
              <Badge className={ASSIGNMENT_STATUS_META[assignment.status].className}>{ASSIGNMENT_STATUS_META[assignment.status].label}</Badge>
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
          <Card title="Assignment details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" required className="sm:col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Scope of work" className="sm:col-span-2"><Textarea rows={3} value={scope} onChange={(e) => setScope(e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Contract amount (₹)"><Input type="number" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Payment terms"><Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Penalty clause" className="sm:col-span-2"><Textarea rows={2} value={penaltyClause} onChange={(e) => setPenaltyClause(e.target.value)} disabled={!canEdit} /></Field>
            </div>

            <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-500">Start date</dt><dd className="text-ink-900">{assignment.startDate ? formatDate(assignment.startDate) : "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">Deadline</dt><dd className="text-ink-900">{assignment.deadline ? formatDate(assignment.deadline) : "—"}</dd></div>
              <div><dt className="text-xs text-ink-500">Created by</dt><dd className="text-ink-900">{assignment.createdBy?.name ?? "—"} · {formatDateTime(assignment.createdAt)}</dd></div>
            </dl>

            {(assignment.linkedQuotationNo || assignment.linkedPoNo || assignment.linkedPiNo || assignment.linkedBoqNo) && (
              <dl className="mt-4 grid gap-3 border-t border-ink-100 pt-4 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Linked documents</div>
                {assignment.linkedQuotationNo && <div><dt className="text-xs text-ink-500">Quotation</dt><dd className="text-ink-900">{assignment.linkedQuotationNo}</dd></div>}
                {assignment.linkedPoNo && <div><dt className="text-xs text-ink-500">Purchase Order</dt><dd className="text-ink-900">{assignment.linkedPoNo}</dd></div>}
                {assignment.linkedPiNo && <div><dt className="text-xs text-ink-500">Proforma Invoice</dt><dd className="text-ink-900">{assignment.linkedPiNo}</dd></div>}
                {assignment.linkedBoqNo && <div><dt className="text-xs text-ink-500">BOQ</dt><dd className="text-ink-900">{assignment.linkedBoqNo}</dd></div>}
              </dl>
            )}

            <Field label="Notes" className="mt-4"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} /></Field>

            {canEdit && (
              <Button variant="primary" className="mt-4" loading={busy} onClick={() => void saveChanges()}>Save changes</Button>
            )}
          </Card>

          <Card
            title="Milestones / stages"
            subtitle={`${assignment.milestones.length} milestone${assignment.milestones.length === 1 ? "" : "s"} · ${formatINR(milestoneTotal)}`}
            actions={canEdit && <Button size="sm" onClick={() => setAddMilestoneOpen(true)}><Plus className="h-3.5 w-3.5" /> Add milestone</Button>}
          >
            {assignment.milestones.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-500">No milestones yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {assignment.milestones.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">{m.name}</p>
                      <p className="text-xs text-ink-500">
                        {m.dueDate ? `Due ${formatDate(m.dueDate)}` : "No due date"}{m.amount ? ` · ${formatINR(m.amount)}` : ""}
                      </p>
                    </div>
                    {canEdit ? (
                      <Select
                        value={m.status}
                        onChange={(e) => void changeMilestoneStatus(m.id, e.target.value as MilestoneStatus)}
                        className="w-auto"
                        options={MILESTONE_STATUSES.map((s) => ({ value: s, label: MILESTONE_STATUS_META[s].label }))}
                      />
                    ) : (
                      <Badge className={MILESTONE_STATUS_META[m.status].className}>{MILESTONE_STATUS_META[m.status].label}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <Card title="Summary" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600">Contract amount</dt><dd className="tabular-nums">{formatINR(assignment.contractAmount)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">Milestones total</dt><dd className="tabular-nums">{formatINR(milestoneTotal)}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-1.5">
                <dt className="text-ink-600">Completed</dt>
                <dd>{assignment.milestones.filter((m) => m.status === "COMPLETED").length} / {assignment.milestones.length}</dd>
              </div>
            </dl>
          </Card>

          <EntityActivityLog entityType="VENDOR_ASSIGNMENT" entityId={assignment.id} />
        </div>
      </div>

      <Modal
        open={addMilestoneOpen}
        onClose={() => setAddMilestoneOpen(false)}
        title="Add milestone"
        footer={(
          <>
            <Button onClick={() => setAddMilestoneOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => void submitMilestone()}>Add</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field label="Name" required><Input value={newMilestone.name} onChange={(e) => setNewMilestone((m) => ({ ...m, name: e.target.value }))} /></Field>
          <Field label="Due date">
            <Input
              type="date"
              value={newMilestone.dueDate ? new Date(newMilestone.dueDate).toISOString().slice(0, 10) : ""}
              onChange={(e) => setNewMilestone((m) => ({ ...m, dueDate: e.target.value ? new Date(e.target.value) : null }))}
            />
          </Field>
          <Field label="Amount (₹)">
            <Input type="number" value={newMilestone.amount ?? ""} onChange={(e) => setNewMilestone((m) => ({ ...m, amount: e.target.value ? Number(e.target.value) : undefined }))} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this assignment?"
        description="Moves it to Trash — it disappears from every list, but this cannot be undone from here."
        footer={(
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!actor) return;
                  await trashVendorAssignment(assignment, actor);
                  router.push("/vendor-assignments");
                }, "Assignment deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete assignment
            </Button>
          </>
        )}
      >
        <p className="text-sm text-ink-700">{assignment.assignmentNo} — {assignment.title}</p>
      </Modal>
    </>
  );
}

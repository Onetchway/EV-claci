"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { Button, Card, Field, Input, Select, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { subscribeBoqsForProject } from "@/lib/db/boq";
import { createVendorAssignment, type MilestoneDraft } from "@/lib/db/vendor-assignments";
import { subscribeProjects } from "@/lib/db/projects";
import { subscribeVendors } from "@/lib/db/vendors";
import { canManageVendorAssignments } from "@/lib/permissions";
import type { Boq, Project, Vendor } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function NewVendorAssignmentPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewVendorAssignmentForm />
    </Suspense>
  );
}

function NewVendorAssignmentForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [boqs, setBoqs] = useState<Boq[]>([]);

  const [vendorId, setVendorId] = useState(params.get("vendorId") ?? "");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [penaltyClause, setPenaltyClause] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [quotationNo, setQuotationNo] = useState("");
  const [poNo, setPoNo] = useState("");
  const [piNo, setPiNo] = useState("");
  const [boqId, setBoqId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => subscribeVendors(setVendors), []);
  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);
  useEffect(() => { if (projectId) return subscribeBoqsForProject(projectId, setBoqs); setBoqs([]); }, [projectId]);

  const vendor = vendors.find((v) => v.id === vendorId);
  const project = projects.find((p) => p.id === projectId);
  const boq = boqs.find((b) => b.id === boqId);

  function addMilestoneRow() {
    setMilestones((m) => [...m, { name: "", dueDate: null, amount: undefined }]);
  }
  function patchMilestone(i: number, patch: Partial<MilestoneDraft>) {
    setMilestones((m) => m.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeMilestone(i: number) {
    setMilestones((m) => m.filter((_, idx) => idx !== i));
  }

  if (!canManageVendorAssignments(viewer)) {
    return <p className="text-sm text-ink-500">You don't have permission to create vendor assignments.</p>;
  }

  async function onCreate() {
    if (!actor || !vendor || !project || !title.trim()) {
      push("Vendor, project and title are required.", "error");
      return;
    }
    await run(async () => {
      const { id } = await createVendorAssignment({
        vendorId: vendor.id, vendorName: vendor.name,
        parentVendorId: vendor.parentVendorId ?? null, parentVendorName: vendor.parentVendorName ?? null,
        projectId: project.id, projectName: project.name,
        title, scope,
        contractAmount: Number(contractAmount) || 0,
        paymentTerms, penaltyClause,
        startDate: startDate ? new Date(startDate) : null,
        deadline: deadline ? new Date(deadline) : null,
        milestones,
        linkedQuotationNo: quotationNo || null,
        linkedPoNo: poNo || null,
        linkedPiNo: piNo || null,
        linkedBoqId: boq?.id ?? null, linkedBoqNo: boq?.boqNo ?? null,
        notes,
      }, actor);
      router.push(`/vendor-assignments/${id}`);
    }, "Assignment created.");
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">New vendor assignment</h1>
        <p className="text-sm text-ink-500">A scope of work for a vendor (or one of its sub-vendors), with its own milestones, payment terms, penalty clause and timeline.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Assignment details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vendor" required>
                <Select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  placeholder="Select vendor…"
                  options={vendors.map((v) => ({ value: v.id, label: v.parentVendorName ? `${v.name} (sub-vendor of ${v.parentVendorName})` : v.name }))}
                />
              </Field>
              <Field label="Project (or sub-project)" required>
                <Select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="Select project…"
                  options={projects.map((p) => ({ value: p.id, label: p.parentProjectCode ? `${p.code} — ${p.name} (sub-project of ${p.parentProjectCode})` : `${p.code} — ${p.name}` }))}
                />
              </Field>
              <Field label="Title" required className="sm:col-span-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Civil works — Phase 2" />
              </Field>
              <Field label="Scope of work" className="sm:col-span-2">
                <Textarea rows={3} value={scope} onChange={(e) => setScope(e.target.value)} />
              </Field>
              <Field label="Contract amount (₹)" required>
                <Input type="number" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} />
              </Field>
              <Field label="Payment terms" hint="e.g. 30% advance, 40% on milestone 2, 30% on completion">
                <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
              </Field>
              <Field label="Start date">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Deadline">
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </Field>
              <Field label="Penalty clause" className="sm:col-span-2" hint="e.g. 1% of contract value per week of delay, capped at 10%">
                <Textarea rows={2} value={penaltyClause} onChange={(e) => setPenaltyClause(e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card
            title="Milestones / stages"
            actions={<Button size="sm" onClick={addMilestoneRow}><Plus className="h-3.5 w-3.5" /> Add milestone</Button>}
          >
            {milestones.length === 0 ? (
              <p className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-xs text-ink-500">
                No milestones yet. Break the work into stages with their own due date and amount.
              </p>
            ) : (
              <div className="space-y-2">
                {milestones.map((m, i) => (
                  <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-ink-200 p-2.5">
                    <div className="col-span-12 sm:col-span-5">
                      <label className="label">Milestone / stage name</label>
                      <input value={m.name} onChange={(e) => patchMilestone(i, { name: e.target.value })} className="input" />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <label className="label">Due date</label>
                      <input
                        type="date"
                        value={m.dueDate ? new Date(m.dueDate).toISOString().slice(0, 10) : ""}
                        onChange={(e) => patchMilestone(i, { dueDate: e.target.value ? new Date(e.target.value) : null })}
                        className="input"
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <label className="label">Amount (₹)</label>
                      <input
                        type="number"
                        value={m.amount ?? ""}
                        onChange={(e) => patchMilestone(i, { amount: e.target.value ? Number(e.target.value) : undefined })}
                        className="input tabular-nums"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-1 flex justify-end">
                      <button type="button" onClick={() => removeMilestone(i)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Linked documents" subtitle="Optional — the Quotation/PO/PI/BOQ this work is actually billed or procured through.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Quotation No."><Input value={quotationNo} onChange={(e) => setQuotationNo(e.target.value)} placeholder="e.g. LG-QT-000123" /></Field>
              <Field label="PO No."><Input value={poNo} onChange={(e) => setPoNo(e.target.value)} placeholder="e.g. LG-PO-000123" /></Field>
              <Field label="PI No."><Input value={piNo} onChange={(e) => setPiNo(e.target.value)} placeholder="e.g. LG-PI-000123" /></Field>
              <Field label="BOQ">
                <Select
                  value={boqId}
                  onChange={(e) => setBoqId(e.target.value)}
                  placeholder={projectId ? "Select BOQ…" : "Select a project first"}
                  options={boqs.map((b) => ({ value: b.id, label: `${b.boqNo} (v${b.version})` }))}
                />
              </Field>
            </div>
          </Card>

          <Card title="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Card>
        </div>

        <div>
          <Card title="Summary" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-600">Contract amount</dt><dd className="tabular-nums">{formatINR(Number(contractAmount) || 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-600">Milestones</dt><dd>{milestones.length}</dd></div>
            </dl>
            <Button
              variant="primary"
              className="mt-4 w-full"
              loading={busy}
              disabled={!vendorId || !projectId || !title.trim()}
              onClick={() => void onCreate()}
            >
              Create assignment
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, Field, Input, Select, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { SubVendorPaymentTermsField, SubVendorStagesField } from "@/components/sub-vendor-fields";
import { SUB_VENDOR_CONTRACT_STATUSES, SUB_VENDOR_CONTRACT_STATUS_META, type SubVendorContractStatus } from "@/lib/constants";
import { createSubVendorContract, type SubVendorPaymentTermInput, type SubVendorStageInput } from "@/lib/db/sub-vendors";
import { subscribeProjects } from "@/lib/db/projects";
import { listActiveVendors } from "@/lib/db/vendors";
import type { Project, Vendor } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function NewSubVendorContractPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewSubVendorContractForm />
    </Suspense>
  );
}

function NewSubVendorContractForm() {
  const router = useRouter();
  const params = useSearchParams();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [projectId, setProjectId] = useState(params.get("projectId") ?? "");
  const [vendorId, setVendorId] = useState(params.get("vendorId") ?? "");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [contractValue, setContractValue] = useState("0");
  const [status, setStatus] = useState<SubVendorContractStatus>("DRAFT");
  const [startDate, setStartDate] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [stages, setStages] = useState<SubVendorStageInput[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<SubVendorPaymentTermInput[]>([]);
  const [penaltyClause, setPenaltyClause] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("0");
  const [penaltyTimelineDays, setPenaltyTimelineDays] = useState("0");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);
  useEffect(() => { void listActiveVendors().then(setVendors); }, []);

  const project = projects.find((p) => p.id === projectId);
  const vendor = vendors.find((v) => v.id === vendorId);

  async function onCreate() {
    if (!projectId || !project || !vendorId || !vendor) {
      push("Project and vendor are required.", "error");
      return;
    }
    await run(async () => {
      const contract = await createSubVendorContract({
        projectId, projectName: project.name, vendorId, vendorName: vendor.name,
        scopeOfWork, contractValue: Number(contractValue) || 0, status,
        startDate: startDate ? new Date(startDate) : null,
        targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
        stages, paymentTerms,
        penaltyClause, penaltyAmount: Number(penaltyAmount) || 0, penaltyTimelineDays: Number(penaltyTimelineDays) || 0,
        terms, notes,
      }, actor);
      router.push(`/sub-vendors/${contract.id}`);
    }, "Sub-vendor contract created.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">New Sub-Vendor Contract</h1>
        <p className="text-sm text-ink-500">Subcontract work on a project (or sub-project) to a vendor, with its own stages, payment schedule, and penalty clause.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Contract details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Project / Sub-project" required className="col-span-2">
                <Select value={projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}${p.parentProjectCode ? ` (sub-project of ${p.parentProjectCode})` : ""}` }))} onChange={(e) => setProjectId(e.target.value)} />
              </Field>
              <Field label="Sub-vendor" required>
                <Select value={vendorId} placeholder="Select vendor…" options={vendors.map((v) => ({ value: v.id, label: v.name }))} onChange={(e) => setVendorId(e.target.value)} />
              </Field>
              <Field label="Status">
                <Select value={status} options={SUB_VENDOR_CONTRACT_STATUSES.map((s) => ({ value: s, label: SUB_VENDOR_CONTRACT_STATUS_META[s].label }))} onChange={(e) => setStatus(e.target.value as SubVendorContractStatus)} />
              </Field>
              <Field label="Scope of work" className="col-span-2"><Textarea value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} placeholder="What this sub-vendor is being subcontracted to do…" /></Field>
              <Field label="Contract Value (₹)"><Input type="number" value={contractValue} onChange={(e) => setContractValue(e.target.value)} /></Field>
              <Field label="Start Date"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="Deadline / Target End Date"><Input type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} /></Field>
            </div>
          </Card>

          <Card title="Stages &amp; timeline">
            <SubVendorStagesField value={stages} onChange={setStages} />
          </Card>

          <Card title="Payment terms">
            <SubVendorPaymentTermsField value={paymentTerms} onChange={setPaymentTerms} />
          </Card>

          <Card title="Penalty clause" subtitle="What happens if the sub-vendor misses the timeline.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Clause" className="col-span-2"><Textarea value={penaltyClause} onChange={(e) => setPenaltyClause(e.target.value)} placeholder="e.g. 1% of contract value per week of delay, capped at 10%" /></Field>
              <Field label="Penalty amount (₹)" hint="A flat amount, if not a %."><Input type="number" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} /></Field>
              <Field label="Grace period (days)" hint="Days past deadline before the penalty applies."><Input type="number" value={penaltyTimelineDays} onChange={(e) => setPenaltyTimelineDays(e.target.value)} /></Field>
            </div>
          </Card>

          <Card title="Terms &amp; notes">
            <div className="grid grid-cols-1 gap-3">
              <Field label="Terms & Conditions"><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
              <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Project</dt><dd className="text-right">{project?.name ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Sub-vendor</dt><dd className="text-right">{vendor?.name ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Contract value</dt><dd className="tabular-nums">{formatINR(Number(contractValue) || 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Stages</dt><dd>{stages.length}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Payment terms</dt><dd>{paymentTerms.length}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => void onCreate()} loading={busy}>Create Contract</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push("/sub-vendors")}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

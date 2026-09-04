"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, EmptyState, Field, Input, Select, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { SubVendorPaymentTermsField, SubVendorStagesField } from "@/components/sub-vendor-fields";
import { SUB_VENDOR_CONTRACT_STATUSES, SUB_VENDOR_CONTRACT_STATUS_META, type SubVendorContractStatus } from "@/lib/constants";
import {
  getSubVendorContract, updateSubVendorContract, type SubVendorPaymentTermInput, type SubVendorStageInput,
} from "@/lib/db/sub-vendors";
import type { SubVendorContract } from "@/lib/types";
import { toDate } from "@/lib/utils";

function toDateInputValue(v: Parameters<typeof toDate>[0]): string {
  const d = toDate(v);
  return d ? d.toISOString().slice(0, 10) : "";
}

export default function EditSubVendorContractPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [contract, setContract] = useState<SubVendorContract | null | undefined>(undefined);
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

  useEffect(() => {
    void getSubVendorContract(id).then((row) => {
      setContract(row);
      if (!row) return;
      setScopeOfWork(row.scopeOfWork ?? "");
      setContractValue(String(row.contractValue ?? 0));
      setStatus(row.status);
      setStartDate(toDateInputValue(row.startDate));
      setTargetEndDate(toDateInputValue(row.targetEndDate));
      setStages(row.stages.map((s) => ({ name: s.name, status: s.status, amount: s.amount, notes: s.notes, startDate: toDate(s.startDate), endDate: toDate(s.endDate) })));
      setPaymentTerms(row.paymentTerms.map((t) => ({ milestone: t.milestone, percent: t.percent, amount: t.amount, status: t.status })));
      setPenaltyClause(row.penaltyClause ?? "");
      setPenaltyAmount(String(row.penaltyAmount ?? 0));
      setPenaltyTimelineDays(String(row.penaltyTimelineDays ?? 0));
      setTerms(row.terms ?? "");
      setNotes(row.notes ?? "");
    });
  }, [id]);

  if (contract === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (contract === null) return <EmptyState title="Sub-vendor contract not found" action={<Link href="/sub-vendors"><Button>Back to sub-vendor contracts</Button></Link>} />;

  async function onSave() {
    await run(async () => {
      await updateSubVendorContract(contract!, {
        scopeOfWork, contractValue: Number(contractValue) || 0, status,
        startDate: startDate ? new Date(startDate) : null,
        targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
        stages, paymentTerms,
        penaltyClause, penaltyAmount: Number(penaltyAmount) || 0, penaltyTimelineDays: Number(penaltyTimelineDays) || 0,
        terms, notes,
      }, actor);
      router.push(`/sub-vendors/${contract!.id}`);
    }, "Sub-vendor contract updated.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">Edit Sub-Vendor Contract</h1>
        <p className="text-sm text-ink-500">{contract.contractNo} — {contract.vendorName} on {contract.projectName}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Contract details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <Select value={status} options={SUB_VENDOR_CONTRACT_STATUSES.map((s) => ({ value: s, label: SUB_VENDOR_CONTRACT_STATUS_META[s].label }))} onChange={(e) => setStatus(e.target.value as SubVendorContractStatus)} />
              </Field>
              <Field label="Contract Value (₹)"><Input type="number" value={contractValue} onChange={(e) => setContractValue(e.target.value)} /></Field>
              <Field label="Scope of work" className="col-span-2"><Textarea value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} /></Field>
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

          <Card title="Penalty clause">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Clause" className="col-span-2"><Textarea value={penaltyClause} onChange={(e) => setPenaltyClause(e.target.value)} /></Field>
              <Field label="Penalty amount (₹)"><Input type="number" value={penaltyAmount} onChange={(e) => setPenaltyAmount(e.target.value)} /></Field>
              <Field label="Grace period (days)"><Input type="number" value={penaltyTimelineDays} onChange={(e) => setPenaltyTimelineDays(e.target.value)} /></Field>
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
            <div className="space-y-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => void onSave()} loading={busy}>Save Changes</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push(`/sub-vendors/${contract!.id}`)}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

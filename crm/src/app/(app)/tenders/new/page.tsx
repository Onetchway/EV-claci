"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { Button, Card, Field, Input, PageHeader, Textarea, useAsyncAction } from "@/components/ui";
import { createTender } from "@/lib/db/tenders";
import { canManageTenders } from "@/lib/permissions";

export default function NewTenderPage() {
  const { actor } = useAuth();
  const viewer = useViewer();
  const router = useRouter();
  const { busy, run } = useAsyncAction();

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

  if (!canManageTenders(viewer)) {
    return <p className="text-sm text-ink-500">You don't have permission to create tenders.</p>;
  }

  async function submit() {
    if (!actor || !title.trim() || !clientName.trim()) return;
    await run(async () => {
      const { id } = await createTender({
        title,
        clientName,
        department,
        authority,
        location,
        tenderNumber,
        tenderValue: tenderValue ? Number(tenderValue) : undefined,
        emdAmount: emdAmount ? Number(emdAmount) : undefined,
        tenderFee: tenderFee ? Number(tenderFee) : undefined,
        submissionDate: submissionDate ? new Date(submissionDate) : null,
        openingDate: openingDate ? new Date(openingDate) : null,
        notes,
      }, actor);
      router.push(`/tenders/${id}`);
    }, "Tender created.");
  }

  return (
    <>
      <PageHeader title="New tender" description="Government or institutional bid — tracked here from prospecting through submission and award." />

      <Card title="Tender details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. EV charging infrastructure — Phase 2" />
          </Field>
          <Field label="Client / Department name" required>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </Field>
          <Field label="Tender number" hint="As issued by the authority">
            <Input value={tenderNumber} onChange={(e) => setTenderNumber(e.target.value)} />
          </Field>
          <Field label="Department">
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </Field>
          <Field label="Issuing authority">
            <Input value={authority} onChange={(e) => setAuthority(e.target.value)} />
          </Field>
          <Field label="Location" className="sm:col-span-2">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Tender value (₹)">
            <Input type="number" value={tenderValue} onChange={(e) => setTenderValue(e.target.value)} />
          </Field>
          <Field label="EMD amount (₹)">
            <Input type="number" value={emdAmount} onChange={(e) => setEmdAmount(e.target.value)} />
          </Field>
          <Field label="Tender fee (₹)">
            <Input type="number" value={tenderFee} onChange={(e) => setTenderFee(e.target.value)} />
          </Field>
          <Field label="Submission date">
            <Input type="date" value={submissionDate} onChange={(e) => setSubmissionDate(e.target.value)} />
          </Field>
          <Field label="Opening date">
            <Input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes on this pursuit." />
          </Field>
        </div>

        <Button
          variant="primary"
          className="mt-4"
          loading={busy}
          disabled={!title.trim() || !clientName.trim()}
          onClick={() => void submit()}
        >
          Create tender
        </Button>
      </Card>
    </>
  );
}

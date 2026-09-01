"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useActor } from "@/components/auth-provider";
import { Button, Card, EmptyState, Field, Input, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { ItemsTable, BOQ_FIELDS, type DraftBoqItem } from "@/components/line-items-table";
import { BOQ_CATEGORIES, type BoqCategory } from "@/lib/constants";
import { getBoq, updateBoq } from "@/lib/db/boq";
import type { Boq, BoqLineItem } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function EditBoqPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [boq, setBoq] = useState<Boq | null | undefined>(undefined);
  const [boqNo, setBoqNo] = useState("");
  const [siteName, setSiteName] = useState("");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftBoqItem[]>([]);

  useEffect(() => {
    void getBoq(id).then((row) => {
      setBoq(row);
      if (!row) return;
      setBoqNo(row.boqNo);
      setSiteName(row.siteName ?? "");
      setTerms(row.terms ?? "");
      setNotes(row.notes ?? "");
      setItems(row.items.map((it) => ({ section: it.section, description: it.description, makeOem: it.makeOem, unit: it.unit, qty: it.qty, supplyRate: it.supplyRate, installationRate: it.installationRate, category: it.category, remarks: it.remarks })));
    });
  }, [id]);

  if (boq === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (boq === null) return <EmptyState title="BOQ not found" action={<Link href="/boq"><Button>Back to BOQ</Button></Link>} />;

  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * ((Number(it.supplyRate) || 0) + (Number(it.installationRate) || 0)), 0);

  async function onSave() {
    if (!boqNo.trim()) {
      push("BOQ number is required.", "error");
      return;
    }
    await run(async () => {
      const cleanItems = items.map((it) => ({ ...it, category: (it.category as BoqCategory) || "OTHER" })) as BoqLineItem[];
      await updateBoq(boq!, { boqNo, siteName, items: cleanItems, terms, notes }, actor);
      router.push(`/boq/${boq!.id}`);
    }, "BOQ updated.");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">Edit BOQ</h1>
        <p className="text-sm text-ink-500">{boq.boqNo} — {boq.projectName}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="BOQ details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="BOQ No." required><Input value={boqNo} onChange={(e) => setBoqNo(e.target.value)} /></Field>
              <Field label="Site Name"><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></Field>
              <Field label="Terms &amp; Conditions" className="col-span-2"><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
              <Field label="Notes" className="col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>
          </Card>

          <Card title="Line items">
            <ItemsTable items={items} setItems={setItems} fields={BOQ_FIELDS} />
            <p className="mt-2 text-xs text-ink-500">Categories: {BOQ_CATEGORIES.join(", ")}.</p>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(total)}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => void onSave()} loading={busy}>Save Changes</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push(`/boq/${boq!.id}`)}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

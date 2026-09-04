"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Upload } from "lucide-react";

import { useAuth, useViewer } from "@/components/auth-provider";
import { Button, Card, Field, Input, Select, Spinner, Textarea, useAsyncAction, useToast } from "@/components/ui";
import { BoqItemsTable, type DraftBoqItem } from "@/components/boq-items-table";
import { parseBoqFile } from "@/lib/boq-parser";
import { createBoq } from "@/lib/db/boq";
import { subscribeProjects } from "@/lib/db/projects";
import { canManageBoq } from "@/lib/permissions";
import { BOQ_CATEGORIES } from "@/lib/constants";
import type { BoqLineItem, Project } from "@/lib/types";
import { formatINR } from "@/lib/utils";

export default function NewBoqPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewBoqForm />
    </Suspense>
  );
}

function NewBoqForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { actor } = useAuth();
  const viewer = useViewer();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [projects, setProjects] = useState<Project[]>([]);
  const [boqNo, setBoqNo] = useState("");
  const [projectId, setProjectId] = useState(params.get("projectId") ?? "");
  const [siteName, setSiteName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftBoqItem[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);

  const project = projects.find((p) => p.id === projectId);
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * ((Number(it.supplyRate) || 0) + (Number(it.installationRate) || 0)), 0);

  if (!canManageBoq(viewer)) {
    return <p className="text-sm text-ink-500">You don't have permission to create BOQs.</p>;
  }

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await parseBoqFile(file);
      if (!parsed.length) throw new Error("Could not detect a BOQ table in this file.");
      setItems(parsed);
      setBoqNo((n) => n || file.name.replace(/\.[^.]+$/, ""));
      push(`Imported ${parsed.length} line items — review before saving.`, "success");
    } catch (err) {
      push((err as Error).message, "error");
    } finally {
      setImporting(false);
    }
  }

  async function onCreate() {
    if (!actor || !boqNo.trim() || !projectId || !project) {
      push("BOQ number and project are required.", "error");
      return;
    }
    await run(async () => {
      const cleanItems = items.map((it) => ({ ...it, category: it.category || "OTHER" })) as BoqLineItem[];
      const { id } = await createBoq({ boqNo, projectId, projectName: project.name, siteName, items: cleanItems, notes }, actor);
      router.push(`/boq/${id}`);
    }, "BOQ created.");
  }

  return (
    <>
      <PageTitle />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="BOQ details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="BOQ No." required><Input value={boqNo} onChange={(e) => setBoqNo(e.target.value)} /></Field>
              <Field label="Project" required>
                <Select
                  value={projectId}
                  placeholder="Select project…"
                  options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                  onChange={(e) => setProjectId(e.target.value)}
                />
              </Field>
              <Field label="Site name"><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} /></Field>
              <Field label="Notes" className="sm:col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>
          </Card>

          <Card
            title="Line items"
            actions={(
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-sm font-medium text-ink-800 hover:bg-ink-50">
                <Upload className="h-3.5 w-3.5" /> {importing ? "Importing…" : "Import from Excel"}
                <input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing} onChange={(e) => void onFileSelect(e)} />
              </label>
            )}
          >
            <BoqItemsTable items={items} onChange={setItems} />
            <p className="mt-2 text-xs text-ink-500">Category defaults to Other for imported rows; categories: {BOQ_CATEGORIES.join(", ")}.</p>
          </Card>
        </div>

        <div>
          <Card title="Summary" className="sticky top-16">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(total)}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" loading={busy} onClick={() => void onCreate()}>Create BOQ</Button>
              <Button className="w-full justify-center" onClick={() => router.push("/boq")}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function PageTitle() {
  return (
    <div className="mb-5">
      <h1 className="text-lg font-semibold text-navy-900">New BOQ</h1>
      <p className="text-sm text-ink-500">Build a Bill of Quantities manually, or import one from Excel below.</p>
    </div>
  );
}

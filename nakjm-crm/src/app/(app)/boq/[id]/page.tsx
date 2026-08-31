"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Copy, Pencil, Printer, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { BoqDiff } from "@/components/boq-diff";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { EntityDocuments } from "@/components/entity-documents";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, useAsyncAction } from "@/components/ui";
import { ItemsTable, BOQ_FIELDS, type DraftBoqItem } from "@/components/line-items-table";
import { BOQ_CATEGORIES, BOQ_STATUSES, type BoqCategory, type BoqStatus } from "@/lib/constants";
import { deleteBoq, reviseBoq, subscribeBoq, subscribeBoqLineage, updateBoq, updateBoqStatus } from "@/lib/db/boq";
import { canManageProcurement, canTrash } from "@/lib/permissions";
import type { Boq, BoqLineItem } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/utils";

export default function BoqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [boq, setBoq] = useState<Boq | null | undefined>(undefined);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState({ boqNo: "", siteName: "", notes: "" });
  const [items, setItems] = useState<DraftBoqItem[]>([]);
  const [lineage, setLineage] = useState<Boq[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareFromId, setCompareFromId] = useState("");
  const [compareToId, setCompareToId] = useState("");

  useEffect(() => subscribeBoq(id, setBoq), [id]);
  useEffect(() => { if (boq) return subscribeBoqLineage(boq.rootBoqId ?? boq.id, setLineage); }, [boq?.id, boq?.rootBoqId]);

  if (boq === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (boq === null) return <EmptyState title="BOQ not found" action={<Link href="/boq"><Button>Back to BOQ</Button></Link>} />;

  const compareFrom = lineage.find((r) => r.id === compareFromId);
  const compareTo = lineage.find((r) => r.id === compareToId);

  async function onRevise() {
    await run(async () => {
      const revision = await reviseBoq(boq!, actor);
      router.push(`/boq/${revision.id}`);
    }, "New version created.");
  }

  function openCompare() {
    const sorted = [...lineage].sort((a, b) => a.version - b.version);
    const idx = sorted.findIndex((r) => r.id === boq!.id);
    setCompareFromId(sorted[Math.max(idx - 1, 0)]?.id ?? sorted[0]?.id ?? "");
    setCompareToId(boq!.id);
    setCompareOpen(true);
  }

  function openEdit() {
    setForm({ boqNo: boq!.boqNo, siteName: boq!.siteName ?? "", notes: boq!.notes ?? "" });
    setItems(boq!.items.map((it) => ({ section: it.section, description: it.description, makeOem: it.makeOem, unit: it.unit, qty: it.qty, supplyRate: it.supplyRate, installationRate: it.installationRate, category: it.category })));
    setEditOpen(true);
  }

  async function onSave() {
    if (!form.boqNo.trim()) return;
    await run(async () => {
      const cleanItems = items.map((it) => ({ ...it, category: (it.category as BoqCategory) || "OTHER" })) as BoqLineItem[];
      await updateBoq(boq!, { boqNo: form.boqNo, siteName: form.siteName, items: cleanItems, notes: form.notes }, actor);
      setEditOpen(false);
    }, "BOQ updated.");
  }

  async function onStatusChange(status: BoqStatus) {
    await run(() => updateBoqStatus(boq!, status, actor), `Marked ${status}.`);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={boq.boqNo}
        description={`${boq.projectName}${boq.siteName ? ` · ${boq.siteName}` : ""} · v${boq.version}`}
        actions={
          <>
            {canManageProcurement(viewer) ? (
              <Select value={boq.status} options={BOQ_STATUSES.map((s) => ({ value: s, label: s }))} onChange={(e) => void onStatusChange(e.target.value as BoqStatus)} />
            ) : (
              <Badge>{boq.status}</Badge>
            )}
            <Link href={`/projects/${boq.projectId}/boq/${boq.id}/print`}>
              <Button><Printer className="h-4 w-4" /> Print / PDF</Button>
            </Link>
            {canManageProcurement(viewer) && <Button onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>}
            {canManageProcurement(viewer) && <Button onClick={() => void onRevise()} loading={busy}><Copy className="h-4 w-4" /> New Version</Button>}
            {lineage.length > 1 && <Button variant="secondary" onClick={openCompare}>Compare Versions</Button>}
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
                    <th className="pb-2">Category</th>
                    <th className="pb-2">Make/OEM</th>
                    <th className="pb-2">Unit</th>
                    <th className="pb-2 text-right">Qty</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {boq.items.map((line) => (
                    <tr key={line.srNo} className="border-b border-ink-100">
                      <td className="py-2">
                        {line.section && <span className="mr-1 text-[10px] font-semibold uppercase text-ink-400">{line.section}</span>}
                        {line.description}
                      </td>
                      <td className="py-2 text-ink-500">{line.category}</td>
                      <td className="py-2 text-ink-500">{line.makeOem || "—"}</td>
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
                <div className="flex justify-between border-t border-ink-200 pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(boq.totalAmount)}</dd></div>
              </dl>
            </div>
          </Card>

          {boq.notes && <Card title="Notes"><p className="whitespace-pre-line text-sm text-ink-700">{boq.notes}</p></Card>}
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Project</dt><dd><Link href={`/projects/${boq.projectId}`} className="text-brand-700 hover:underline">{boq.projectName}</Link></dd></div>
              {boq.siteName && <div className="flex justify-between"><dt className="text-ink-500">Site</dt><dd>{boq.siteName}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-500">Date</dt><dd>{formatDate(boq.boqDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Version</dt><dd>v{boq.version}</dd></div>
            </dl>
          </Card>

          {lineage.length > 1 && (
            <Card title="Versions">
              <ul className="space-y-1.5 text-sm">
                {[...lineage].sort((a, b) => b.version - a.version).map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    {r.id === boq.id ? (
                      <span className="font-medium text-ink-900">v{r.version} (current)</span>
                    ) : (
                      <Link href={`/boq/${r.id}`} className="text-brand-700 hover:underline">v{r.version}</Link>
                    )}
                    <Badge>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <EntityDocuments projectId={boq.projectId} entityType="BOQ" entityId={boq.id} defaultDocType="BOQ_UPLOAD" title="BOQ Documents" />

          <EntityActivityLog entityType="BOQ" entityId={boq.id} />
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit BOQ"
        wide
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => void onSave()} loading={busy}>Save</Button></>}
      >
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field label="BOQ No." required><Input value={form.boqNo} onChange={(e) => setForm((f) => ({ ...f, boqNo: e.target.value }))} /></Field>
          <Field label="Site Name"><Input value={form.siteName} onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))} /></Field>
        </div>
        <ItemsTable items={items} setItems={setItems} fields={BOQ_FIELDS} />
        <p className="mt-2 text-xs text-ink-500">Categories: {BOQ_CATEGORIES.join(", ")}.</p>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this BOQ?"
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { await deleteBoq(boq!, actor); router.push("/boq"); }, "BOQ deleted.")}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        <p className="text-sm text-ink-700">{boq.boqNo}</p>
      </Modal>

      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="Compare versions" wide footer={<Button onClick={() => setCompareOpen(false)}>Close</Button>}>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field label="From">
            <Select value={compareFromId} options={[...lineage].sort((a, b) => a.version - b.version).map((r) => ({ value: r.id, label: `v${r.version}` }))} onChange={(e) => setCompareFromId(e.target.value)} />
          </Field>
          <Field label="To">
            <Select value={compareToId} options={[...lineage].sort((a, b) => a.version - b.version).map((r) => ({ value: r.id, label: `v${r.version}` }))} onChange={(e) => setCompareToId(e.target.value)} />
          </Field>
        </div>
        {compareFrom && compareTo ? <BoqDiff from={compareFrom} to={compareTo} /> : <p className="text-sm text-ink-400">Select two versions to compare.</p>}
      </Modal>
    </div>
  );
}

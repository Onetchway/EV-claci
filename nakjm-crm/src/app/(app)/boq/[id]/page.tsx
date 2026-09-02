"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Copy, Pencil, Printer, ShieldCheck, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { BoqDiff } from "@/components/boq-diff";
import { EntityActivityLog } from "@/components/entity-activity-log";
import { EntityDocuments } from "@/components/entity-documents";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAsyncAction } from "@/components/ui";
import { BOQ_STATUSES, type BoqStatus } from "@/lib/constants";
import { approveBoq, deleteBoq, reviseBoq, subscribeBoq, subscribeBoqLineage, updateBoqStatus } from "@/lib/db/boq";
import { canManageProcurement, canTrash } from "@/lib/permissions";
import type { Boq } from "@/lib/types";
import { formatDate, formatDateTime, formatINR } from "@/lib/utils";

const NON_APPROVAL_STATUSES = BOQ_STATUSES.filter((s) => s !== "APPROVED");

export default function BoqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [boq, setBoq] = useState<Boq | null | undefined>(undefined);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lineage, setLineage] = useState<Boq[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareFromId, setCompareFromId] = useState("");
  const [compareToId, setCompareToId] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [approvalNote, setApprovalNote] = useState("");

  useEffect(() => subscribeBoq(id, setBoq), [id]);
  useEffect(() => { if (boq) return subscribeBoqLineage(boq.rootBoqId ?? boq.id, setLineage); }, [boq?.id, boq?.rootBoqId]);

  if (boq === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (boq === null) return <EmptyState title="BOQ not found" action={<Link href="/boq"><Button>Back to BOQ</Button></Link>} />;

  const compareFrom = lineage.find((r) => r.id === compareFromId);
  const compareTo = lineage.find((r) => r.id === compareToId);

  async function onApprove() {
    await run(async () => {
      await approveBoq(boq!, signatureName, approvalNote, actor);
      setApproveOpen(false);
      setSignatureName("");
      setApprovalNote("");
    }, "BOQ approved.");
  }

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
              <Select
                value={boq.status}
                options={(boq.status === "APPROVED" ? BOQ_STATUSES : NON_APPROVAL_STATUSES).map((s) => ({ value: s, label: s }))}
                onChange={(e) => void onStatusChange(e.target.value as BoqStatus)}
              />
            ) : (
              <Badge>{boq.status}</Badge>
            )}
            {canManageProcurement(viewer) && boq.status !== "APPROVED" && (
              <Button variant="primary" onClick={() => setApproveOpen(true)}><ShieldCheck className="h-4 w-4" /> Approve</Button>
            )}
            <Link href={`/projects/${boq.projectId}/boq/${boq.id}/print`}>
              <Button><Printer className="h-4 w-4" /> Print / PDF</Button>
            </Link>
            {canManageProcurement(viewer) && boq.status !== "APPROVED" && (
              <Link href={`/boq/${boq.id}/edit`}><Button><Pencil className="h-4 w-4" /> Edit</Button></Link>
            )}
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
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3">Description</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Make/OEM</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right">Qty</th>
                    <th className="whitespace-nowrap px-3 py-2 text-right">Rate</th>
                    <th className="whitespace-nowrap py-2 pl-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {boq.items.map((line) => (
                    <tr key={line.srNo} className="border-b border-ink-100">
                      <td className="py-2.5 pr-3 align-top">
                        {line.section && <span className="mr-1 text-[10px] font-semibold uppercase text-ink-400">{line.section}</span>}
                        {line.description}
                      </td>
                      <td className="px-3 py-2.5 align-top text-ink-500">{line.category}</td>
                      <td className="px-3 py-2.5 align-top text-ink-500">{line.makeOem || "—"}</td>
                      <td className="px-3 py-2.5 align-top text-ink-500">{line.unit || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums">{line.qty}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums">{formatINR(line.rate)}</td>
                      <td className="whitespace-nowrap py-2.5 pl-3 text-right align-top tabular-nums">{formatINR(line.amount)}</td>
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

          <Card title="Terms &amp; conditions">
            {boq.terms ? (
              <p className="whitespace-pre-line text-sm text-ink-700">{boq.terms}</p>
            ) : (
              <p className="text-sm text-ink-400">No terms added yet.{canManageProcurement(viewer) && boq.status !== "APPROVED" ? " Click Edit to add." : ""}</p>
            )}
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

          {boq.approval && (
            <Card title="Approval">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-500">Approved by</dt><dd>{boq.approval.approvedBy.name}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">Signed</dt><dd>{boq.approval.signatureName}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">Date</dt><dd>{formatDateTime(boq.approval.approvedAt)}</dd></div>
              </dl>
              {boq.approval.note && <p className="mt-2 border-t border-ink-100 pt-2 text-sm text-ink-700">{boq.approval.note}</p>}
            </Card>
          )}

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

      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve this BOQ"
        description={`Type your name exactly as shown ("${actor.name}") to confirm approval — this is recorded as your sign-off.`}
        footer={<><Button variant="secondary" onClick={() => setApproveOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => void onApprove()}><ShieldCheck className="h-4 w-4" /> Confirm Approval</Button></>}
      >
        <div className="space-y-3">
          <Field label="Your name" required hint={`Type: ${actor.name}`}>
            <Input value={signatureName} onChange={(e) => setSignatureName(e.target.value)} />
          </Field>
          <Field label="Note (optional)"><Textarea value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}

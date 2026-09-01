"use client";

/**
 * Shared UI for EOI and Agreement — both are LegalDocument records (prose
 * letters: subject + free-text body, no line items or GST), distinguished
 * only by docType. Rather than duplicating the list/new/detail pages for
 * each, every route under /eoi and /agreements renders these generic
 * components parameterized by docType, mirroring how PrintHeader/PrintFooter
 * already share letterhead logic across document print pages.
 */

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Copy, FileText, Plus, Printer, ShieldCheck, Trash2 } from "lucide-react";

import { useActor, useViewer } from "@/components/auth-provider";
import { EntityActivityLog } from "@/components/entity-activity-log";
import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAsyncAction, useToast,
} from "@/components/ui";
import { PrintFooter, PrintHeader, PrintSheet, PrintToolbar } from "@/components/print-document";
import { LEGAL_DOC_STATUS_META, LEGAL_DOC_STATUSES, LEGAL_DOC_TYPE_LABEL, type LegalDocStatus, type LegalDocType } from "@/lib/constants";
import { getClient } from "@/lib/db/clients";
import {
  approveLegalDocument, createLegalDocument, deleteLegalDocument, getLegalDocument, reviseLegalDocument,
  subscribeLegalDocument, subscribeLegalDocumentLineage, subscribeLegalDocuments, updateLegalDocumentStatus,
} from "@/lib/db/legal-documents";
import { subscribeProjects } from "@/lib/db/projects";
import { canManageProcurement, canTrash } from "@/lib/permissions";
import type { Client, LegalDocument, Project } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

const NON_APPROVAL_STATUSES = LEGAL_DOC_STATUSES.filter((s) => s !== "ACCEPTED");

interface DocTypeConfig {
  docType: LegalDocType;
  /** e.g. "/eoi" or "/agreements" */
  basePath: string;
}

/* ---------------------------------------------------------------- List ---------------------------------------------------------------- */

export function LegalDocumentListPage({ docType, basePath }: DocTypeConfig) {
  const label = LEGAL_DOC_TYPE_LABEL[docType];
  const [rows, setRows] = useState<LegalDocument[] | null>(null);
  const [status, setStatus] = useState<LegalDocStatus | "ALL">("ALL");

  useEffect(() => subscribeLegalDocuments(docType, setRows), [docType]);

  const filtered = !rows ? [] : status === "ALL" ? rows : rows.filter((r) => r.status === status);

  return (
    <div>
      <PageHeader
        title={`${label}s`}
        description={`Every ${label.toLowerCase()} and its versions, across every project.`}
        actions={
          <>
            <Select
              value={status}
              className="w-auto"
              options={[{ value: "ALL", label: "All statuses" }, ...LEGAL_DOC_STATUSES.map((s) => ({ value: s, label: LEGAL_DOC_STATUS_META[s].label }))]}
              onChange={(e) => setStatus(e.target.value as LegalDocStatus | "ALL")}
            />
            <Link href={`${basePath}/new`}><Button variant="primary"><Plus className="h-4 w-4" /> New {label}</Button></Link>
          </>
        }
      />

      {!rows ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={`No ${label.toLowerCase()}s yet`}
          description={`Create one here, or from a project's ${label} tab — either way it links to the project.`}
          action={<Link href={`${basePath}/new`}><Button variant="primary"><Plus className="h-4 w-4" /> New {label}</Button></Link>}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">No.</th>
                <th className="th">Project</th>
                <th className="th">Client</th>
                <th className="th">Version</th>
                <th className="th">Status</th>
                <th className="th">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t border-ink-100 hover:bg-ink-50">
                  <td className="td font-medium"><Link href={`${basePath}/${d.id}`} className="text-brand-700 hover:underline">{d.docNo}</Link></td>
                  <td className="td"><Link href={`/projects/${d.projectId}`} className="text-ink-600 hover:underline">{d.projectName}</Link></td>
                  <td className="td">{d.clientName}</td>
                  <td className="td">v{d.version}</td>
                  <td className="td"><Badge className={LEGAL_DOC_STATUS_META[d.status].className}>{LEGAL_DOC_STATUS_META[d.status].label}</Badge></td>
                  <td className="td">{formatDate(d.docDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- New ---------------------------------------------------------------- */

export function NewLegalDocumentPage({ docType, basePath }: DocTypeConfig) {
  return (
    <Suspense fallback={<div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>}>
      <NewLegalDocumentForm docType={docType} basePath={basePath} />
    </Suspense>
  );
}

function NewLegalDocumentForm({ docType, basePath }: DocTypeConfig) {
  const label = LEGAL_DOC_TYPE_LABEL[docType];
  const router = useRouter();
  const params = useSearchParams();
  const actor = useActor();
  const { push } = useToast();
  const { busy, run } = useAsyncAction();

  const [projects, setProjects] = useState<Project[]>([]);
  const [docNo, setDocNo] = useState("");
  const [projectId, setProjectId] = useState(params.get("projectId") ?? "");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => subscribeProjects({ status: "ALL", max: 500 }, setProjects), []);

  const project = projects.find((p) => p.id === projectId);

  async function onCreate() {
    if (!docNo.trim() || !projectId || !project || !subject.trim() || !body.trim()) {
      push("Doc No., project, subject and body are required.", "error");
      return;
    }
    await run(async () => {
      const created = await createLegalDocument({
        docType, docNo, projectId, projectName: project.name, clientId: project.clientId, clientName: project.clientName,
        docDate: new Date(docDate), validUntil: validUntil ? new Date(validUntil) : null,
        subject, body, terms, notes,
      }, actor);
      router.push(`${basePath}/${created.id}`);
    }, `${label} created.`);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-navy-900">New {label}</h1>
        <p className="text-sm text-ink-500">Prepare a{/^[aeiou]/i.test(label) ? "n" : ""} {label.toLowerCase()} letter against a project.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={`${label} details`}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Doc No." required><Input value={docNo} onChange={(e) => setDocNo(e.target.value)} /></Field>
              <Field label="Project" required>
                <Select value={projectId} placeholder="Select project…" options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} onChange={(e) => setProjectId(e.target.value)} />
              </Field>
              <Field label="Date" required><Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} /></Field>
              <Field label="Valid Until"><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></Field>
              <Field label="Subject" required className="col-span-2"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
              <Field label="Body" required className="col-span-2" hint="The letter's main content."><Textarea className="min-h-[240px]" value={body} onChange={(e) => setBody(e.target.value)} /></Field>
              <Field label="Terms &amp; Conditions" className="col-span-2"><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
              <Field label="Notes" className="col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Project</dt><dd>{project?.name ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Client</dt><dd>{project?.clientName ?? "—"}</dd></div>
            </dl>
            <div className="mt-4 space-y-2">
              <Button variant="primary" className="w-full justify-center" onClick={() => void onCreate()} loading={busy}>Create {label}</Button>
              <Button variant="secondary" className="w-full justify-center" onClick={() => router.push(basePath)}>Cancel</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Detail --------------------------------------------------------------- */

export function LegalDocumentDetailPage({ docType, basePath }: DocTypeConfig) {
  const label = LEGAL_DOC_TYPE_LABEL[docType];
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const viewer = useViewer();
  const { busy, run } = useAsyncAction();

  const [d, setD] = useState<LegalDocument | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [lineage, setLineage] = useState<LegalDocument[]>([]);

  useEffect(() => subscribeLegalDocument(id, setD), [id]);
  useEffect(() => { if (d?.clientId) void getClient(d.clientId).then(setClient); }, [d?.clientId]);
  useEffect(() => { if (d) return subscribeLegalDocumentLineage(d.rootDocId ?? d.id, setLineage); }, [d?.id, d?.rootDocId]);

  if (d === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (d === null) return <EmptyState title={`${label} not found`} action={<Link href={basePath}><Button>Back to {label.toLowerCase()}s</Button></Link>} />;

  async function onRevise() {
    await run(async () => {
      const revision = await reviseLegalDocument(d!, actor);
      router.push(`${basePath}/${revision.id}`);
    }, "New version created.");
  }

  async function onStatusChange(status: LegalDocStatus) {
    await run(() => updateLegalDocumentStatus(d!.id, status, actor, { docType, docNo: d!.docNo, projectId: d!.projectId }), `Marked ${LEGAL_DOC_STATUS_META[status].label}.`);
  }

  async function onApprove() {
    await run(async () => {
      await approveLegalDocument(d!, signatureName, approvalNote, actor);
      setApproveOpen(false);
      setSignatureName("");
      setApprovalNote("");
    }, `${label} accepted.`);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={d.docNo}
        description={`${client?.name ?? d.clientName ?? "—"} · v${d.version}`}
        actions={
          <>
            {canManageProcurement(viewer) ? (
              <Select
                value={d.status}
                options={(d.status === "ACCEPTED" ? LEGAL_DOC_STATUSES : NON_APPROVAL_STATUSES).map((s) => ({ value: s, label: LEGAL_DOC_STATUS_META[s].label }))}
                onChange={(e) => void onStatusChange(e.target.value as LegalDocStatus)}
              />
            ) : (
              <Badge className={LEGAL_DOC_STATUS_META[d.status].className}>{LEGAL_DOC_STATUS_META[d.status].label}</Badge>
            )}
            {canManageProcurement(viewer) && d.status !== "ACCEPTED" && (
              <Button variant="primary" onClick={() => setApproveOpen(true)}><ShieldCheck className="h-4 w-4" /> Accept</Button>
            )}
            <Link href={`/projects/${d.projectId}/${docType === "EOI" ? "eoi" : "agreements"}/${d.id}/print`}>
              <Button><Printer className="h-4 w-4" /> Print / PDF</Button>
            </Link>
            {canManageProcurement(viewer) && <Button onClick={() => void onRevise()} loading={busy}><Copy className="h-4 w-4" /> New Version</Button>}
            {canTrash(viewer) && (
              <Button className="text-rose-700 hover:bg-rose-50" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Subject"><p className="text-sm font-medium text-ink-900">{d.subject}</p></Card>
          <Card title="Body"><p className="whitespace-pre-line text-sm text-ink-700">{d.body}</p></Card>
          {d.terms && <Card title="Terms &amp; conditions"><p className="whitespace-pre-line text-sm text-ink-700">{d.terms}</p></Card>}
          {d.notes && <Card title="Notes"><p className="whitespace-pre-line text-sm text-ink-700">{d.notes}</p></Card>}
        </div>

        <div className="space-y-4">
          <Card title="Details">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Client</dt><dd>{client ? <Link href={`/clients/${client.id}`} className="text-brand-700 hover:underline">{client.name}</Link> : (d.clientName || "—")}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Project</dt><dd><Link href={`/projects/${d.projectId}`} className="text-brand-700 hover:underline">{d.projectName}</Link></dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Date</dt><dd>{formatDate(d.docDate)}</dd></div>
              {d.validUntil && <div className="flex justify-between"><dt className="text-ink-500">Valid until</dt><dd>{formatDate(d.validUntil)}</dd></div>}
            </dl>
          </Card>

          {lineage.length > 1 && (
            <Card title="Versions">
              <ul className="space-y-1.5 text-sm">
                {[...lineage].sort((a, b) => b.version - a.version).map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    {r.id === d.id ? (
                      <span className="font-medium text-ink-900">v{r.version} (current)</span>
                    ) : (
                      <Link href={`${basePath}/${r.id}`} className="text-brand-700 hover:underline">v{r.version}</Link>
                    )}
                    <Badge className={LEGAL_DOC_STATUS_META[r.status].className}>{LEGAL_DOC_STATUS_META[r.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {d.approval && (
            <Card title="Approval">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-ink-500">Accepted by</dt><dd>{d.approval.approvedBy.name}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">Signed</dt><dd>{d.approval.signatureName}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-500">Date</dt><dd>{formatDateTime(d.approval.approvedAt)}</dd></div>
              </dl>
              {d.approval.note && <p className="mt-2 border-t border-ink-100 pt-2 text-sm text-ink-700">{d.approval.note}</p>}
            </Card>
          )}

          <EntityActivityLog entityType={docType} entityId={d.id} />
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete this ${label.toLowerCase()}?`}
        description="This cannot be undone."
        footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={() => void run(async () => { await deleteLegalDocument(d!, actor); router.push(basePath); }, `${label} deleted.`)}><Trash2 className="h-4 w-4" /> Delete</Button></>}
      >
        <p className="text-sm text-ink-700">{d.docNo}</p>
      </Modal>

      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title={`Accept this ${label.toLowerCase()}`}
        description={`Type your name exactly as shown ("${actor.name}") to confirm acceptance — this is recorded as your sign-off.`}
        footer={<><Button variant="secondary" onClick={() => setApproveOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={() => void onApprove()}><ShieldCheck className="h-4 w-4" /> Confirm Acceptance</Button></>}
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

/* ---------------------------------------------------------------- Print --------------------------------------------------------------- */

export function LegalDocumentPrintPage({ docType }: { docType: LegalDocType }) {
  const label = LEGAL_DOC_TYPE_LABEL[docType];
  const { id, docId } = useParams<{ id: string; docId: string }>();
  const [d, setD] = useState<LegalDocument | null | undefined>(undefined);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    void getLegalDocument(docId).then(async (row) => {
      setD(row);
      if (row?.clientId) setClient(await getClient(row.clientId));
    });
  }, [docId]);

  if (d === undefined) return <div className="flex justify-center py-20 text-ink-400"><Spinner className="h-7 w-7" /></div>;
  if (d === null) return <EmptyState title={`${label} not found`} />;

  return (
    <div>
      <PrintToolbar backHref={`/projects/${id}`} />

      <PrintSheet>
        <PrintHeader
          docLabel={label}
          docNumber={d.docNo}
          meta={<p className="mt-0.5 text-[11px] text-ink-400">Version {d.version} &middot; {formatDate(d.docDate)}</p>}
        />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-500">To</p>
            <p className="font-medium text-ink-900">{client?.name ?? d.clientName ?? "—"}</p>
            {client?.contactName && <p className="text-ink-600">{client.contactName}</p>}
            {client?.contactPhone && <p className="text-ink-600">{client.contactPhone}</p>}
            {client?.gstin && <p className="text-ink-600">GSTIN: {client.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-500">Project</p>
            <p className="text-ink-900">{d.projectName}</p>
            {d.validUntil && (<><p className="mt-2 text-xs text-ink-500">Valid until</p><p className="text-ink-900">{formatDate(d.validUntil)}</p></>)}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold text-ink-900">{d.subject}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{d.body}</p>
        </div>

        {d.terms && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Terms</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-700">{d.terms}</p>
          </div>
        )}

        {d.notes && (
          <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{d.notes}</div>
        )}

        {d.approval && (
          <div className="mt-8 border-t border-ink-200 pt-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Accepted</p>
            <p className="mt-1 text-ink-900">{d.approval.signatureName}</p>
            <p className="text-xs text-ink-500">{formatDate(d.approval.approvedAt)}</p>
          </div>
        )}

        <PrintFooter />
      </PrintSheet>
    </div>
  );
}

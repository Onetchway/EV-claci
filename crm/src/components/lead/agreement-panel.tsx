"use client";

import {
  Clock, Download, ExternalLink, FileText, Plus, Printer, Send, Trash2, Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, ProgressBar, Select, useAsyncAction, useToast,
} from "@/components/ui";
import { PrintDocument, PrintFooter, PrintHeader } from "@/components/print-letterhead";
import { useSettings } from "@/hooks/use-settings";
import {
  AGREEMENT_SCHEDULE_FIELDS, AGREEMENT_STATUSES, AGREEMENT_STATUS_COLOR, AGREEMENT_STATUS_LABEL,
  type AgreementScheduleKey, type AgreementStatus,
} from "@/lib/constants";
import { AGREEMENT_CLAUSES, AGREEMENT_RECITALS } from "@/lib/agreement-template";
import { deleteDocument, subscribeDocuments, uploadDocument, validateFile } from "@/lib/db/documents";
import {
  buildAgreementFromLead, deleteAgreement, deleteAgreementVersion, issueAgreement,
  nextAgreementNumber, regenerateAgreement, saveAgreement, setAgreementStatus,
  subscribeAgreementVersions,
} from "@/lib/db/leads";
import { canDeleteDocument, canDeleteEoi, canIssueEoi, type Viewer } from "@/lib/permissions";
import type { Actor, AgreementDoc, AgreementVersion, AppSettings, Lead, LeadDocument } from "@/lib/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 ring-amber-200",
  VERIFIED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 ring-rose-200",
};

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The alternative to drafting in-system: upload an already-signed or
 * externally-drawn-up Agreement as a file. Uses the same leads/{id}/documents
 * storage as the Documents tab (kind FRANCHISE_AGREEMENT) — so a file
 * uploaded here shows up there too, and vice versa — which is also exactly
 * what the investor portal already reads to show the Agreement under its
 * Documents section.
 */
function UploadedAgreementsCard({
  lead, actor, viewer, canEdit,
}: {
  lead: Lead;
  actor: Actor;
  viewer: Viewer;
  canEdit: boolean;
}) {
  const [docs, setDocs] = useState<LeadDocument[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LeadDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, run } = useAsyncAction();
  const { push } = useToast();

  const mergedFromIds = (lead.mergedFrom ?? []).map((m) => m.id);
  useEffect(
    () => subscribeDocuments([lead.id, ...mergedFromIds], (rows) => setDocs(rows.filter((d) => d.kind === "FRANCHISE_AGREEMENT"))),
    [lead.id, mergedFromIds.join(",")],
  );

  function pickFile(f: File | null) {
    if (!f) return;
    const problem = validateFile(f);
    if (problem) { push(problem, "error"); return; }
    void run(async () => {
      setProgress(0);
      try {
        await uploadDocument(lead, f, { kind: "FRANCHISE_AGREEMENT", onProgress: setProgress }, actor);
      } finally {
        setProgress(null);
      }
    }, "Agreement uploaded.");
  }

  if (docs.length === 0 && !canEdit) return null;

  return (
    <Card
      className="print:hidden"
      title="Uploaded copies"
      subtitle={docs.length ? `${docs.length} file${docs.length === 1 ? "" : "s"} on record` : "A signed PDF or scan, as an alternative to drafting in-system."}
      actions={
        canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
              className="hidden"
              onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
            />
            <Button size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Upload signed Agreement
            </Button>
          </>
        )
      }
    >
      {progress !== null && <ProgressBar pct={progress} />}
      {docs.length === 0 ? (
        <p className="text-sm text-ink-500">No signed copy uploaded yet.</p>
      ) : (
        <div className="divide-y divide-ink-100">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-900">{d.fileName}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {fileSize(d.size)} · uploaded {formatDateTime(d.uploadedAt)} by {d.uploadedBy?.name}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge className={cn("ml-1", STATUS_STYLE[d.status])}>{d.status}</Badge>
                <a href={d.url} target="_blank" rel="noreferrer" className="rounded p-1.5 text-ink-500 hover:bg-ink-50 hover:text-brand-700">
                  <ExternalLink className="h-4 w-4" />
                </a>
                {canDeleteDocument(viewer, d) && (
                  <Button size="sm" onClick={() => setConfirmDelete(d)} className="text-rose-700 hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete this file?"
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (confirmDelete) await deleteDocument(lead, confirmDelete, actor);
                  setConfirmDelete(null);
                }, "File deleted.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      >
        {confirmDelete && <p className="text-sm text-ink-700">{confirmDelete.fileName} will be permanently removed.</p>}
      </Modal>
    </Card>
  );
}

const EDITABLE =
  "w-full resize-y rounded border border-transparent bg-transparent px-1 leading-relaxed hover:border-ink-200 hover:bg-ink-50 " +
  "focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 print:border-0 print:bg-transparent print:px-0";

function EditableParagraph({
  value, onChange, readOnly, className,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  className?: string;
}) {
  if (readOnly) return <p className={className}>{value}</p>;
  // A <textarea>'s fixed row height doesn't reflow like real text, so on a
  // document this long it throws off the print pagination and shows a boxy
  // edit control instead of prose. Print always renders the plain paragraph;
  // the textarea is screen-only.
  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(1, Math.ceil(value.length / 110))}
        className={`${EDITABLE} text-sm print:hidden ${className ?? ""}`}
      />
      <p className={`hidden print:block ${className ?? ""}`}>{value}</p>
    </>
  );
}

/** The letter itself — shared between the live editable draft and a read-only archived version, and reused verbatim by the investor portal. */
export function AgreementLetterArticle({
  agreement, company, arbitrationSeat, readOnly, onPatch,
}: {
  agreement: AgreementDoc;
  company: AppSettings["company"];
  /** From the issuing tenant's own Settings → Letter of Intent — where this Agreement is executed, for the opening recital. */
  arbitrationSeat: string;
  readOnly?: boolean;
  /** When set, Schedule I, recitals and clause text all become editable directly on the letter — mirrors how the Letter of Intent stays editable inline. */
  onPatch?: (p: Partial<AgreementDoc>) => void;
}) {
  const recitals = agreement.recitals ?? AGREEMENT_RECITALS;
  const clauses = agreement.clauses ?? AGREEMENT_CLAUSES;
  const editable = Boolean(onPatch) && !readOnly;

  function patchSchedule(key: AgreementScheduleKey, value: string) {
    onPatch?.({ scheduleI: { ...agreement.scheduleI, [key]: value } });
  }

  function patchRecital(index: number, value: string) {
    onPatch?.({ recitals: recitals.map((r, i) => (i === index ? value : r)) });
  }

  function patchClauseParagraph(clauseIdx: number, paraIdx: number, value: string) {
    onPatch?.({
      clauses: clauses.map((c, ci) =>
        ci === clauseIdx ? { ...c, paragraphs: c.paragraphs.map((p, pi) => (pi === paraIdx ? value : p)) } : c),
    });
  }

  return (
    <article className="loi-sheet loi-letter rounded-xl border border-ink-200 bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
      <PrintDocument
        header={<PrintHeader company={company} docLabel="Franchise and Commercial Partnership Agreement" docNumber={agreement.number} />}
        footer={<PrintFooter company={company} />}
      >
        <h1 className="text-center text-base font-bold uppercase tracking-wide text-ink-900">EV Charging Station</h1>
        <h2 className="mt-1 text-center text-sm font-bold uppercase tracking-wide text-ink-700">Franchise and Commercial Partnership Agreement</h2>
        <p className="mt-4 text-sm text-ink-700">
          This Franchise and Commercial Partnership Agreement (&ldquo;Agreement&rdquo;) is entered into on this{" "}
          {agreement.issuedDate ? formatDate(agreement.issuedDate) : "____"} (&ldquo;Effective Date&rdquo;)
          {arbitrationSeat ? `, at ${arbitrationSeat},` : ","} by and between{" "}
          <strong>{company.legalName || "[COMPANY NAME]"}</strong> (&ldquo;{company.shortName || "the Company"}&rdquo; or the &ldquo;Franchisor&rdquo;) and{" "}
          <strong>{agreement.scheduleI.clientName || "[CLIENT NAME]"}</strong> (&ldquo;Franchisee&rdquo;), collectively the &ldquo;Parties&rdquo;.
        </p>

        <h3 className="mt-5 text-sm font-bold text-ink-900">RECITALS</h3>
        {recitals.map((r, i) => (
          <div key={i} className="mt-2 flex gap-1.5 text-sm leading-relaxed text-ink-700">
            <strong className="shrink-0">{String.fromCharCode(65 + i)}.</strong>
            <EditableParagraph
              readOnly={!editable}
              value={r}
              onChange={(v) => patchRecital(i, v)}
              className="flex-1 text-ink-700"
            />
          </div>
        ))}

        {clauses.map((c, ci) => (
          <div key={c.number} className="mt-5">
            <h3 className="text-sm font-bold text-ink-900">{c.number}. {c.heading}</h3>
            {c.paragraphs.map((p, pi) => (
              <EditableParagraph
                key={pi}
                readOnly={!editable}
                value={p}
                onChange={(v) => patchClauseParagraph(ci, pi, v)}
                className="mt-2 text-ink-700"
              />
            ))}
          </div>
        ))}

        <h3 className="mt-6 text-sm font-bold text-ink-900">IN WITNESS WHEREOF</h3>
        <p className="mt-2 text-sm text-ink-700">The duly authorised representatives of the Parties have executed this Agreement on the date first written above.</p>

        <div className="mt-6 grid grid-cols-2 gap-8 text-sm text-ink-700">
          <div>
            <p className="font-semibold text-ink-900">For {company.legalName || "the Company"}</p>
            <p className="mt-4">Signature: ____________________________</p>
            <p className="mt-2">Name: ____________________________</p>
            <p className="mt-2">Designation: ____________________________</p>
            <p className="mt-2">Date: ____________________________</p>
          </div>
          <div>
            <p className="font-semibold text-ink-900">For {agreement.scheduleI.clientName || "the Franchisee"}</p>
            <p className="mt-4">Signature: ____________________________</p>
            <p className="mt-2">Name: ____________________________</p>
            <p className="mt-2">Designation: ____________________________</p>
            <p className="mt-2">Date: ____________________________</p>
          </div>
        </div>

        <h3 className="mt-8 text-center text-sm font-bold text-ink-900">SCHEDULE I</h3>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-500">Site, Charger, Tenure and Commercial Details</p>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-ink-300 bg-brand-700 px-3 py-1.5 text-left text-xs font-semibold text-white">Parameter</th>
              <th className="border border-ink-300 bg-brand-700 px-3 py-1.5 text-left text-xs font-semibold text-white">Detail</th>
            </tr>
          </thead>
          <tbody>
            {AGREEMENT_SCHEDULE_FIELDS.map((f, i) => (
              <tr key={f.key} className={i % 2 === 0 ? "bg-ink-50" : "bg-white"}>
                <td className="border border-ink-300 px-3 py-1.5 font-medium text-ink-800">{f.label}</td>
                <td className="border border-ink-300 px-3 py-1.5 text-ink-700">
                  {editable ? (
                    <>
                      <input
                        value={agreement.scheduleI[f.key] ?? ""}
                        onChange={(e) => patchSchedule(f.key, e.target.value)}
                        placeholder="—"
                        aria-label={f.label}
                        className="w-full rounded border border-transparent bg-transparent px-1 hover:border-ink-200 hover:bg-ink-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 print:hidden"
                      />
                      <span className="hidden print:inline">{agreement.scheduleI[f.key] || "—"}</span>
                    </>
                  ) : (
                    agreement.scheduleI[f.key] || "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PrintDocument>
    </article>
  );
}

export function AgreementPanel({
  lead, actor, viewer, canEdit,
}: {
  lead: Lead;
  actor: Actor;
  viewer: Viewer;
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<AgreementDoc | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [versions, setVersions] = useState<AgreementVersion[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<AgreementVersion | null>(null);
  const { busy, run } = useAsyncAction();
  const { settings } = useSettings();
  const company = settings.company;

  const mergedFromIds = (lead.mergedFrom ?? []).map((m) => m.id);
  useEffect(
    () => subscribeAgreementVersions([lead.id, ...mergedFromIds], setVersions),
    [lead.id, mergedFromIds.join(",")],
  );

  const agreement = draft ?? lead.agreement;
  // Once a saved Agreement exists, any local draft is an unsaved live edit.
  // Before that, `draft` instead holds the not-yet-saved Create form (see
  // the early return below), so it's never "dirty" in that sense.
  const dirty = draft !== null && lead.agreement != null;

  async function startCreate() {
    const number = await nextAgreementNumber();
    setDraft(buildAgreementFromLead(lead, number));
    setCreateOpen(true);
  }

  function patchSchedule(key: AgreementScheduleKey, value: string) {
    setDraft((d) => {
      const base = d ?? lead.agreement;
      if (!base) return d;
      return { ...base, scheduleI: { ...base.scheduleI, [key]: value } };
    });
  }

  // General patch for the live letter — Schedule I cells, recitals and
  // clause paragraphs all flow through here, same as the modal-only
  // patchSchedule above but for the whole document.
  function patch(p: Partial<AgreementDoc>) {
    setDraft((d) => {
      const base = d ?? lead.agreement;
      if (!base) return d;
      return { ...base, ...p };
    });
  }

  // Pulls fresh Schedule I values from the lead's Letter of Intent and site/
  // client details without touching fields that have no source there (e.g.
  // Buyback Floor Value) — a targeted refresh, not a full rebuild.
  function fetchFromLead() {
    setDraft((d) => {
      const base = d ?? lead.agreement;
      if (!base) return d;
      const built = buildAgreementFromLead(lead, base.number);
      return { ...base, scheduleI: { ...base.scheduleI, ...built.scheduleI } };
    });
  }

  // Stay on the empty/create-modal view for as long as nothing is actually
  // saved yet — `draft` here is the not-yet-persisted Create form, and it
  // must not fall through to the main (already-saved) toolbar below, or
  // "Save changes"/"Mark issued" end up acting on an Agreement that was
  // never written to Firestore.
  if (!lead.agreement) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="No Franchise Agreement yet"
          description="Draft one from the lead's own details, or upload an already-signed or externally-drawn-up copy below."
          action={canEdit && <Button variant="primary" onClick={() => void startCreate()}><Plus className="h-4 w-4" /> Draft Agreement</Button>}
        />
        <UploadedAgreementsCard lead={lead} actor={actor} viewer={viewer} canEdit={canEdit} />
        <CreateModal
          open={createOpen}
          draft={draft}
          onClose={() => { setCreateOpen(false); setDraft(null); }}
          onPatch={patchSchedule}
          onFetch={fetchFromLead}
          busy={busy}
          onSave={() =>
            void run(async () => {
              if (!draft) return;
              await saveAgreement(lead, draft, actor);
              setCreateOpen(false);
              setDraft(null);
            }, "Agreement drafted.")
          }
        />
      </div>
    );
  }

  const current = agreement!;

  return (
    <div className="space-y-4">
      <Card
        className="print:hidden"
        title="Franchise Agreement"
        subtitle={`${current.number} · ${AGREEMENT_STATUS_LABEL[current.status]}${dirty ? " · Unsaved changes" : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={AGREEMENT_STATUS_COLOR[current.status]}>{AGREEMENT_STATUS_LABEL[current.status]}</Badge>
            {versions.length > 0 && (
              <Button size="sm" onClick={() => setVersionsOpen(true)}>
                <Clock className="h-3.5 w-3.5" /> Previous versions ({versions.length})
              </Button>
            )}
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
            </Button>
            {canEdit && (
              <Button size="sm" onClick={fetchFromLead} title="Pull fresh values from this lead's Letter of Intent, client and site details into Schedule I, without discarding fields that have no source there.">
                <Download className="h-3.5 w-3.5" /> Fetch from EOI / lead
              </Button>
            )}
            {canEdit && (
              <Button
                size="sm"
                variant={dirty ? "primary" : "secondary"}
                disabled={!dirty}
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    if (draft) await saveAgreement(lead, draft, actor);
                    setDraft(null);
                  }, "Agreement saved.")
                }
              >
                Save changes
              </Button>
            )}
            {canEdit && (
              <Button
                size="sm"
                onClick={() => { setDraft(current); setRegenerateOpen(true); }}
                title="Rebuild Schedule I from this lead's current details under a new Agreement number — the current one is archived first, not lost."
              >
                Regenerate
              </Button>
            )}
            {canIssueEoi(viewer) && current.status === "DRAFT" && (
              <Button
                size="sm"
                variant="primary"
                loading={busy}
                onClick={() => void run(() => issueAgreement(lead, actor), "Agreement issued.")}
              >
                <Send className="h-3.5 w-3.5" /> Mark issued
              </Button>
            )}
            {canIssueEoi(viewer) && current.status !== "DRAFT" && (
              <Select
                value={current.status}
                onChange={(e) => void run(() => setAgreementStatus(lead, e.target.value as AgreementStatus, actor), "Status updated.")}
                className="w-auto"
                options={AGREEMENT_STATUSES.map((s) => ({ value: s, label: AGREEMENT_STATUS_LABEL[s] }))}
              />
            )}
            {canDeleteEoi(viewer) && (
              <Button size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        }
      >
        <p className="text-xs text-ink-500">
          {canEdit && current.status !== "SIGNED"
            ? "Click any line below — recitals, clauses or Schedule I — to edit it directly, then Save changes."
            : "Recitals, clauses and Schedule I are seeded from the standard template and can be edited per lead."}
          {current.issuedDate && ` Issued ${formatDateTime(current.issuedDate)}.`}
        </p>
      </Card>

      <div className="print:block">
        <AgreementLetterArticle
          agreement={current}
          company={company}
          arbitrationSeat={settings.loi.arbitrationSeat}
          readOnly={!canEdit || current.status === "SIGNED"}
          onPatch={canEdit ? patch : undefined}
        />
      </div>

      <UploadedAgreementsCard lead={lead} actor={actor} viewer={viewer} canEdit={canEdit} />

      <Modal
        open={regenerateOpen}
        onClose={() => { setRegenerateOpen(false); setDraft(null); }}
        title="Edit Schedule I"
        description="Regenerating archives the current Agreement to Previous versions, then replaces it with these details under a new number."
        footer={
          <>
            <Button onClick={() => { setRegenerateOpen(false); setDraft(null); }}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  if (!draft) return;
                  const number = draft.number === lead.agreement?.number ? await nextAgreementNumber() : draft.number;
                  await regenerateAgreement(lead, { ...draft, number, status: "DRAFT", issuedDate: null }, actor);
                  setRegenerateOpen(false);
                  setDraft(null);
                }, "Agreement regenerated.")
              }
            >
              Save as new version
            </Button>
          </>
        }
      >
        <ScheduleForm draft={draft} onPatch={patchSchedule} onFetch={fetchFromLead} />
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this Agreement?"
        description="It will be archived to Previous versions, not permanently erased."
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => void run(async () => { await deleteAgreement(lead, actor); setDeleteOpen(false); }, "Agreement deleted.")}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">{current.number} will move to Previous versions.</p>
      </Modal>

      <Modal
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        title="Previous versions"
        footer={<Button onClick={() => setVersionsOpen(false)}>Done</Button>}
        wide
      >
        <div className="divide-y divide-ink-100">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="font-medium text-ink-900">{v.number} <Badge className={`ml-1 ${AGREEMENT_STATUS_COLOR[v.status]}`}>{AGREEMENT_STATUS_LABEL[v.status]}</Badge></p>
                <p className="text-xs text-ink-500">Archived {formatDateTime(v.archivedAt)} by {v.archivedBy?.name}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setViewingVersion(v)}>View</Button>
                {canDeleteEoi(viewer) && (
                  <Button size="sm" onClick={() => void run(() => deleteAgreementVersion(lead, v, actor), "Version deleted.")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={viewingVersion !== null}
        onClose={() => setViewingVersion(null)}
        title={viewingVersion ? `${viewingVersion.number} (archived)` : ""}
        footer={<Button onClick={() => setViewingVersion(null)}>Close</Button>}
        wide
      >
        {viewingVersion && (
          <AgreementLetterArticle
            agreement={viewingVersion}
            company={company}
            arbitrationSeat={settings.loi.arbitrationSeat}
            readOnly
          />
        )}
      </Modal>
    </div>
  );
}

function ScheduleForm({
  draft, onPatch, onFetch,
}: {
  draft: AgreementDoc | null;
  onPatch: (key: AgreementScheduleKey, value: string) => void;
  onFetch?: () => void;
}) {
  if (!draft) return null;
  return (
    <div className="space-y-4">
      {onFetch && (
        <Button size="sm" onClick={onFetch} title="Pull fresh values from this lead's Letter of Intent, client and site details — fields with no source there are left as they are.">
          <Download className="h-3.5 w-3.5" /> Fetch from EOI / lead
        </Button>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {AGREEMENT_SCHEDULE_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <Input
              value={draft.scheduleI[f.key] ?? ""}
              onChange={(e) => onPatch(f.key, e.target.value)}
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function CreateModal({
  open, draft, onClose, onPatch, onFetch, onSave, busy,
}: {
  open: boolean;
  draft: AgreementDoc | null;
  onClose: () => void;
  onPatch: (key: AgreementScheduleKey, value: string) => void;
  onFetch?: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Draft the Franchise Agreement"
      description="Fill in Schedule I — the 20 standard clauses need no editing."
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={onSave}>
            <FileText className="h-4 w-4" /> Save draft
          </Button>
        </>
      }
    >
      <ScheduleForm draft={draft} onPatch={onPatch} onFetch={onFetch} />
    </Modal>
  );
}

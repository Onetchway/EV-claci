"use client";

import { Clock, Download, FileText, Plus, Printer, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Select, useAsyncAction,
} from "@/components/ui";
import { PrintDocument, PrintFooter, PrintHeader } from "@/components/print-letterhead";
import { useSettings } from "@/hooks/use-settings";
import {
  AGREEMENT_SCHEDULE_FIELDS, AGREEMENT_STATUSES, AGREEMENT_STATUS_COLOR, AGREEMENT_STATUS_LABEL,
  type AgreementScheduleKey, type AgreementStatus,
} from "@/lib/constants";
import { AGREEMENT_CLAUSES, AGREEMENT_RECITALS } from "@/lib/agreement-template";
import {
  buildAgreementFromLead, deleteAgreement, deleteAgreementVersion, issueAgreement,
  nextAgreementNumber, regenerateAgreement, saveAgreement, setAgreementStatus,
  subscribeAgreementVersions,
} from "@/lib/db/leads";
import { canDeleteEoi, canIssueEoi, type Viewer } from "@/lib/permissions";
import type { Actor, AgreementDoc, AgreementVersion, AppSettings, Lead } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

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
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={Math.max(1, Math.ceil(value.length / 110))}
      className={`${EDITABLE} text-sm ${className ?? ""}`}
    />
  );
}

/** The letter itself — shared between the live editable draft and a read-only archived version, and reused verbatim by the investor portal. */
export function AgreementLetterArticle({
  agreement, company, readOnly, onPatch,
}: {
  agreement: AgreementDoc;
  company: AppSettings["company"];
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
          {agreement.issuedDate ? formatDate(agreement.issuedDate) : "____"} (&ldquo;Effective Date&rdquo;), at Lucknow, Uttar Pradesh, by and between{" "}
          <strong>Livanto Green Infra Private Limited</strong> (&ldquo;Livanto&rdquo; or the &ldquo;Franchisor&rdquo;) and{" "}
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
            <p className="font-semibold text-ink-900">For Livanto Green Infra Private Limited</p>
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
                    <input
                      value={agreement.scheduleI[f.key] ?? ""}
                      onChange={(e) => patchSchedule(f.key, e.target.value)}
                      placeholder="—"
                      aria-label={f.label}
                      className="w-full rounded border border-transparent bg-transparent px-1 hover:border-ink-200 hover:bg-ink-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 print:border-0 print:bg-transparent print:px-0"
                    />
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

  if (!lead.agreement && !draft) {
    return (
      <>
        <EmptyState
          title="No Franchise Agreement yet"
          description="Draft one from the lead's own details, or upload an already-signed copy from the Documents tab."
          action={canEdit && <Button variant="primary" onClick={() => void startCreate()}><Plus className="h-4 w-4" /> Draft Agreement</Button>}
        />
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
      </>
    );
  }

  const current = agreement!;

  return (
    <div className="space-y-4">
      <Card
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
            : "Recitals, clauses and Schedule I are seeded from Livanto's standard template and can be edited per lead."}
          {current.issuedDate && ` Issued ${formatDateTime(current.issuedDate)}.`}
        </p>
      </Card>

      <div className="print:block">
        <AgreementLetterArticle
          agreement={current}
          company={company}
          readOnly={!canEdit || current.status === "SIGNED"}
          onPatch={canEdit ? patch : undefined}
        />
      </div>

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
        {viewingVersion && <AgreementLetterArticle agreement={viewingVersion} company={company} readOnly />}
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

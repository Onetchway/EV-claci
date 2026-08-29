"use client";

import { Clock, FileText, Plus, Printer, Send, Trash2 } from "lucide-react";
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

/** The letter itself — shared between the live editable draft and a read-only archived version, and reused verbatim by the investor portal. */
export function AgreementLetterArticle({
  agreement, company, readOnly,
}: {
  agreement: AgreementDoc;
  company: AppSettings["company"];
  readOnly?: boolean;
}) {
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
        {AGREEMENT_RECITALS.map((r, i) => (
          <p key={i} className="mt-2 text-sm leading-relaxed text-ink-700">
            <strong>{String.fromCharCode(65 + i)}.</strong> {r}
          </p>
        ))}

        {AGREEMENT_CLAUSES.map((c) => (
          <div key={c.number} className="mt-5">
            <h3 className="text-sm font-bold text-ink-900">{c.number}. {c.heading}</h3>
            {c.paragraphs.map((p, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-ink-700">{p}</p>
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
                <td className="border border-ink-300 px-3 py-1.5 text-ink-700">{agreement.scheduleI[f.key] || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!readOnly && null}
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

  async function startCreate() {
    const number = await nextAgreementNumber();
    setDraft(buildAgreementFromLead(lead, number));
    setCreateOpen(true);
  }

  async function startRegenerate() {
    const number = await nextAgreementNumber();
    setDraft(buildAgreementFromLead(lead, number));
    setRegenerateOpen(true);
  }

  function patchSchedule(key: AgreementScheduleKey, value: string) {
    setDraft((d) => (d ? { ...d, scheduleI: { ...d.scheduleI, [key]: value } } : d));
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
        subtitle={`${current.number} · ${AGREEMENT_STATUS_LABEL[current.status]}`}
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
              <Button size="sm" onClick={() => { setDraft(current); setRegenerateOpen(true); }}>
                Edit / Regenerate
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
          The 20 clauses are Livanto&apos;s standard legal terms and are not edited per lead — only Schedule I (site &amp; commercial specifics) below varies.
          {current.issuedDate && ` Issued ${formatDateTime(current.issuedDate)}.`}
        </p>
      </Card>

      <div className="print:block">
        <AgreementLetterArticle agreement={current} company={company} />
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
        <ScheduleForm draft={draft} onPatch={patchSchedule} />
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
  draft, onPatch,
}: {
  draft: AgreementDoc | null;
  onPatch: (key: AgreementScheduleKey, value: string) => void;
}) {
  if (!draft) return null;
  return (
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
  );
}

function CreateModal({
  open, draft, onClose, onPatch, onSave, busy,
}: {
  open: boolean;
  draft: AgreementDoc | null;
  onClose: () => void;
  onPatch: (key: AgreementScheduleKey, value: string) => void;
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
      <ScheduleForm draft={draft} onPatch={onPatch} />
    </Modal>
  );
}

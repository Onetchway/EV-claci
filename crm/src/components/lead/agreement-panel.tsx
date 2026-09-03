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
  AGREEMENT_PAYMENT_MODEL_LABEL, AGREEMENT_PAYMENT_MODELS, AGREEMENT_SCHEDULE_FIELDS,
  AGREEMENT_SITE_HOLDER_LABEL, AGREEMENT_SITE_HOLDERS, AGREEMENT_STATUSES,
  AGREEMENT_STATUS_COLOR, AGREEMENT_STATUS_LABEL,
  type AgreementPaymentModel, type AgreementScheduleKey, type AgreementSiteHolder, type AgreementStatus,
} from "@/lib/constants";
import {
  AGREEMENT_ANNEXURE_A_HEADING, AGREEMENT_ANNEXURE_A_INTRO, AGREEMENT_ANNEXURE_A_PARAGRAPHS,
  AGREEMENT_ANNEXURE_A_SUBTITLE, AGREEMENT_CLAUSES, AGREEMENT_OPERATIVE_WORDS, AGREEMENT_PREAMBLE,
  AGREEMENT_RECITALS, AGREEMENT_SCHEDULE_II_PART_D_NOTE, AGREEMENT_SCHEDULE_III,
  AGREEMENT_SCHEDULE_IV, AGREEMENT_TITLE,
} from "@/lib/agreement-template";
import { deleteDocument, subscribeDocuments, uploadDocument, validateFile } from "@/lib/db/documents";
import {
  buildAgreementFromLead, deleteAgreement, deleteAgreementVersion, issueAgreement,
  nextAgreementNumber, regenerateAgreement, saveAgreement, setAgreementStatus,
  subscribeAgreementVersions,
} from "@/lib/db/leads";
import { canDeleteDocument, canDeleteEoi, canIssueEoi, type Viewer } from "@/lib/permissions";
import type {
  Actor, AgreementBomRow, AgreementDoc, AgreementVersion, AppSettings, Lead, LeadDocument,
} from "@/lib/types";
import { cn, formatDate, formatDateTime, formatINR } from "@/lib/utils";

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

/** A single Schedule I cell — dual-rendered input (screen) / span (print), same print-safety pattern as the rest of the document. */
function ScheduleCell({
  value, onChange, readOnly, label,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  label: string;
}) {
  if (readOnly) return <>{value || "—"}</>;
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        aria-label={label}
        className="w-full rounded border border-transparent bg-transparent px-1 hover:border-ink-200 hover:bg-ink-50 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 print:hidden"
      />
      <span className="hidden print:inline">{value || "—"}</span>
    </>
  );
}

/** Part C keys that only apply under the Fixed Payment side of the selected Payment Model (A or C). */
const FIXED_PAYMENT_KEYS: AgreementScheduleKey[] = ["fixedMonthlyAmount", "fixedPaymentPeriod", "fixedPaymentAggregate"];
/** Part C keys that only apply under the Revenue Share side of the selected Payment Model (B or C). */
const REVENUE_SHARE_KEYS: AgreementScheduleKey[] = [
  "landUsageFeeRate", "landUsageFeePayee", "livantoFeeRate", "minimumAssuredAmount", "payoutPeriod", "maxAggregateCap",
];

/** Schedule I, Part C's own field list, narrowed to what the Selected Payment Model actually makes operative — Model A shows Fixed Payment fields only, Model B shows Revenue Share fields only, Model C shows both in sequence (Clause 9.2), and "Fixed Payment Period" itself only ever applies to Model C (Model A's fixed period is simply the whole Term). */
function partCFields(paymentModel: AgreementPaymentModel) {
  return AGREEMENT_SCHEDULE_FIELDS.filter((f) => {
    if (f.part !== "C") return false;
    if (f.key === "fixedPaymentPeriod") return paymentModel === "C";
    if (FIXED_PAYMENT_KEYS.includes(f.key)) return paymentModel === "A" || paymentModel === "C";
    if (REVENUE_SHARE_KEYS.includes(f.key)) return paymentModel === "B" || paymentModel === "C";
    return true;
  });
}

function SchedulePartTable({
  part, agreement, readOnly, onPatch,
}: {
  part: "A" | "B" | "C" | "D";
  agreement: AgreementDoc;
  readOnly: boolean;
  onPatch: (key: AgreementScheduleKey, value: string) => void;
}) {
  const fields = part === "C" ? partCFields(agreement.paymentModel) : AGREEMENT_SCHEDULE_FIELDS.filter((f) => f.part === part);
  return (
    <table className="mt-3 w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="border border-ink-300 bg-brand-700 px-3 py-1.5 text-left text-xs font-semibold text-white">Parameter</th>
          <th className="border border-ink-300 bg-brand-700 px-3 py-1.5 text-left text-xs font-semibold text-white">Detail</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((f, i) => (
          <tr key={f.key} className={i % 2 === 0 ? "bg-ink-50" : "bg-white"}>
            <td className="border border-ink-300 px-3 py-1.5 font-medium text-ink-800">{f.label}</td>
            <td className="border border-ink-300 px-3 py-1.5 text-ink-700">
              <ScheduleCell
                value={agreement.scheduleI[f.key] ?? ""}
                onChange={(v) => onPatch(f.key, v)}
                readOnly={readOnly}
                label={f.label}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Schedule II, Part A / B — the Charging Station / Infrastructure Works BOM tables, auto-seeded from the quote and freely editable thereafter. GST is computed per row from that row's own gstPct, not a flat rate. */
function BomTable({
  title, items, readOnly, onChange,
}: {
  title: string;
  items: AgreementBomRow[];
  readOnly: boolean;
  onChange: (rows: AgreementBomRow[]) => void;
}) {
  function patchRow(id: string, p: Partial<AgreementBomRow>) {
    onChange(items.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }
  const subtotal = items.reduce((a, r) => a + r.value, 0);

  return (
    <>
      <table className="mt-3 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-ink-300 bg-ink-50 break-inside-avoid">
            <th className="w-10 px-2 py-1.5 text-left font-semibold">S.No.</th>
            <th className="px-2 py-1.5 text-left font-semibold">Item Description</th>
            <th className="w-32 px-2 py-1.5 text-left font-semibold">Serial No.</th>
            <th className="w-14 px-2 py-1.5 text-right font-semibold">Qty</th>
            <th className="w-24 px-2 py-1.5 text-right font-semibold">Value (Rs.)</th>
            <th className="w-14 px-2 py-1.5 text-right font-semibold">GST %</th>
            <th className="w-24 px-2 py-1.5 text-right font-semibold">Total (Rs.)</th>
            {!readOnly && <th className="w-8 print:hidden" />}
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => {
            const lineTotal = row.value * (1 + row.gstPct / 100);
            return (
              <tr key={row.id} className="border-b border-ink-200 align-top break-inside-avoid">
                <td className="px-2 py-1.5 tabular-nums">{i + 1}</td>
                <td className="px-2 py-1.5">
                  {readOnly ? row.description : (
                    <input
                      value={row.description}
                      onChange={(e) => patchRow(row.id, { description: e.target.value })}
                      className="w-full rounded border border-transparent bg-transparent px-1 hover:border-ink-200 hover:bg-ink-50 focus:border-brand-400 focus:bg-white focus:outline-none print:border-0"
                      aria-label={`Description for row ${i + 1}`}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {readOnly ? (row.serialNo || "—") : (
                    <input
                      value={row.serialNo}
                      onChange={(e) => patchRow(row.id, { serialNo: e.target.value })}
                      placeholder="—"
                      className="w-full rounded border border-transparent bg-transparent px-1 hover:border-ink-200 hover:bg-ink-50 focus:border-brand-400 focus:bg-white focus:outline-none print:border-0"
                      aria-label={`Serial number for row ${i + 1}`}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {readOnly ? row.qty : (
                    <input
                      type="number"
                      value={row.qty || ""}
                      onChange={(e) => patchRow(row.id, { qty: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-transparent bg-transparent px-1 text-right hover:border-ink-200 hover:bg-ink-50 focus:border-brand-400 focus:bg-white focus:outline-none print:border-0"
                      aria-label={`Quantity for row ${i + 1}`}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {readOnly ? formatINR(row.value) : (
                    <input
                      type="number"
                      value={row.value || ""}
                      onChange={(e) => patchRow(row.id, { value: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-transparent bg-transparent px-1 text-right hover:border-ink-200 hover:bg-ink-50 focus:border-brand-400 focus:bg-white focus:outline-none print:border-0"
                      aria-label={`Value for row ${i + 1}`}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {readOnly ? row.gstPct : (
                    <input
                      type="number"
                      value={row.gstPct || ""}
                      onChange={(e) => patchRow(row.id, { gstPct: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-transparent bg-transparent px-1 text-right hover:border-ink-200 hover:bg-ink-50 focus:border-brand-400 focus:bg-white focus:outline-none print:border-0"
                      aria-label={`GST percent for row ${i + 1}`}
                    />
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(lineTotal)}</td>
                {!readOnly && (
                  <td className="px-1 py-1.5 print:hidden">
                    <button
                      type="button"
                      onClick={() => onChange(items.filter((r) => r.id !== row.id))}
                      className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Remove row ${i + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
          <tr className="border-b-2 border-ink-400 font-bold break-inside-avoid">
            <td />
            <td className="px-2 py-2" colSpan={4}>Sub-total — {title}</td>
            <td className="px-2 py-2" />
            <td className="px-2 py-2 text-right tabular-nums">{formatINR(subtotal)}</td>
            {!readOnly && <td className="print:hidden" />}
          </tr>
        </tbody>
      </table>
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...items, { id: `bom${Date.now()}`, description: "", serialNo: "", qty: 1, value: 0, gstPct: 18 }])}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline print:hidden"
        >
          <Plus className="h-3 w-3" /> Add a row
        </button>
      )}
    </>
  );
}

/** The letter itself — shared between the live editable draft and a read-only archived version, and reused verbatim by the investor portal. */
export function AgreementLetterArticle({
  agreement, company, readOnly, onPatch,
}: {
  agreement: AgreementDoc;
  company: AppSettings["company"];
  readOnly?: boolean;
  /** When set, Schedule I/II, recitals and clause text all become editable directly on the letter — mirrors how the Letter of Intent stays editable inline. */
  onPatch?: (p: Partial<AgreementDoc>) => void;
}) {
  const recitals = agreement.recitals ?? AGREEMENT_RECITALS;
  const clauses = agreement.clauses ?? AGREEMENT_CLAUSES;
  const chargingStationItems = agreement.chargingStationItems ?? [];
  const infrastructureItems = agreement.infrastructureItems ?? [];
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

  const consideration = chargingStationItems.reduce((a, r) => a + r.value, 0) + infrastructureItems.reduce((a, r) => a + r.value, 0);
  const considerationGst = consideration * 0.18;
  const annexureItems = [...chargingStationItems, ...infrastructureItems];

  return (
    <article className="loi-sheet loi-letter rounded-xl border border-ink-200 bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
      <PrintDocument
        header={<PrintHeader company={company} docLabel="EV Charging Station Franchise and Operation Agreement" docNumber={agreement.number} />}
        footer={<PrintFooter company={company} />}
      >
        <h1 className="text-center text-base font-bold uppercase tracking-wide text-ink-900">EV Charging Station</h1>
        <h2 className="mt-1 text-center text-sm font-bold uppercase tracking-wide text-ink-700">{AGREEMENT_TITLE}</h2>

        {AGREEMENT_PREAMBLE.map((p, i) => (
          <p key={i} className="mt-3 text-sm leading-relaxed text-ink-700">{p}</p>
        ))}

        {editable && (
          <div className="mt-3 flex flex-wrap items-center gap-4 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-700">Site Holder (Schedule I, Part A):</span>
              <Select
                value={agreement.siteHolder}
                onChange={(e) => onPatch?.({ siteHolder: e.target.value as AgreementSiteHolder })}
                className="w-auto"
                options={AGREEMENT_SITE_HOLDERS.map((s) => ({ value: s, label: AGREEMENT_SITE_HOLDER_LABEL[s] }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-700">Selected Payment Model (Schedule I, Part C):</span>
              <Select
                value={agreement.paymentModel}
                onChange={(e) => onPatch?.({ paymentModel: e.target.value as AgreementPaymentModel })}
                className="w-auto"
                options={AGREEMENT_PAYMENT_MODELS.map((m) => ({ value: m, label: AGREEMENT_PAYMENT_MODEL_LABEL[m] }))}
              />
            </div>
          </div>
        )}
        <p className="hidden text-sm font-semibold text-ink-800 print:block">
          Site Holder: {AGREEMENT_SITE_HOLDER_LABEL[agreement.siteHolder]} · Selected Payment Model: {AGREEMENT_PAYMENT_MODEL_LABEL[agreement.paymentModel]}
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

        <p className="mt-4 text-sm leading-relaxed text-ink-700">{AGREEMENT_OPERATIVE_WORDS}</p>

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
            <p className="font-semibold text-ink-900">For {agreement.scheduleI.franchiseeName || "the Franchisee"}</p>
            <p className="mt-4">Signature: ____________________________</p>
            <p className="mt-2">Name: ____________________________</p>
            <p className="mt-2">Designation: ____________________________</p>
            <p className="mt-2">Date: ____________________________</p>
          </div>
        </div>

        {/* Schedule I */}
        <h3 className="mt-8 text-center text-sm font-bold text-ink-900 break-before-page">SCHEDULE I</h3>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-500">Site, Charger, Tenure and Commercial Particulars</p>
        <p className="mt-2 text-sm text-ink-700">
          The Parties confirm that the particulars set out in this Schedule I are accurate as at the date of execution
          of this Agreement and form an integral part thereof.
        </p>

        <h4 className="mt-4 text-sm font-bold text-ink-900">Part A — Parties and Site</h4>
        <p className="mt-1 text-xs text-ink-600">
          Site Holder (tick one): {AGREEMENT_SITE_HOLDER_LABEL[agreement.siteHolder]} — see Clauses 2.3, 5.6, 7.1, 7.6 and 21.9.
        </p>
        <SchedulePartTable part="A" agreement={agreement} readOnly={!editable} onPatch={patchSchedule} />

        <h4 className="mt-5 text-sm font-bold text-ink-900">Part B — Charging Station and Tenure</h4>
        <SchedulePartTable part="B" agreement={agreement} readOnly={!editable} onPatch={patchSchedule} />

        <h4 className="mt-5 text-sm font-bold text-ink-900">Part C — Commercial Terms</h4>
        <p className="mt-1 text-xs text-ink-600">
          Selected Payment Model (tick one): {AGREEMENT_PAYMENT_MODEL_LABEL[agreement.paymentModel]}. The rows below are narrowed
          to the fields that Model makes operative — Model C shows both the Fixed Payment and Revenue Share fields, in sequence.
        </p>
        <SchedulePartTable part="C" agreement={agreement} readOnly={!editable} onPatch={patchSchedule} />

        <h4 className="mt-5 text-sm font-bold text-ink-900">Part D — Buyback Particulars</h4>
        <SchedulePartTable part="D" agreement={agreement} readOnly={!editable} onPatch={patchSchedule} />

        {/* Schedule II */}
        <h3 className="mt-8 text-center text-sm font-bold text-ink-900 break-before-page">SCHEDULE II</h3>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-500">Bill of Material, Consideration and Asset Identification</p>
        <p className="mt-2 text-sm text-ink-700">
          The Franchisee Assets sold by Livanto to the Franchisee under Clause 5 comprise the items in Parts A and B
          below. The Franchisee is and shall remain the sole and absolute owner of every item so listed.
        </p>

        <h4 className="mt-4 text-sm font-bold text-ink-900">Part A — Charging Station (charger equipment)</h4>
        <BomTable
          title="Charging Station (Original Equipment Cost)"
          items={chargingStationItems}
          readOnly={!editable}
          onChange={(rows) => onPatch?.({ chargingStationItems: rows })}
        />

        <h4 className="mt-5 text-sm font-bold text-ink-900">Part B — Infrastructure Works (funded by and owned by the Franchisee)</h4>
        <p className="mt-1 text-xs text-ink-600">
          The following are funded by the Franchisee out of the consideration under Part C and belong absolutely to
          the Franchisee. They do not form part of the Charging Station and are dealt with separately on expiry or
          termination under Clause 21.9.
        </p>
        <BomTable
          title="Infrastructure Works"
          items={infrastructureItems}
          readOnly={!editable}
          onChange={(rows) => onPatch?.({ infrastructureItems: rows })}
        />

        <h4 className="mt-5 text-sm font-bold text-ink-900">Part C — Total Consideration</h4>
        <table className="mt-2 w-full max-w-md border-collapse text-sm">
          <tbody>
            <tr className="border-b border-ink-200">
              <td className="px-2 py-1.5">Total Consideration (Parts A + B, exclusive of GST)</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(consideration)}</td>
            </tr>
            <tr className="border-b border-ink-200">
              <td className="px-2 py-1.5">GST @ 18%</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatINR(considerationGst)}</td>
            </tr>
            <tr className="border-b-2 border-ink-400 font-bold">
              <td className="px-2 py-2">Total Payable</td>
              <td className="px-2 py-2 text-right tabular-nums">{formatINR(consideration + considerationGst)}</td>
            </tr>
          </tbody>
        </table>

        <h4 className="mt-5 text-sm font-bold text-ink-900">Part D — Warranty and AMC Included in the Consideration</h4>
        <p className="mt-2 text-sm text-ink-700">{AGREEMENT_SCHEDULE_II_PART_D_NOTE}</p>

        {/* Schedule III */}
        <h3 className="mt-8 text-center text-sm font-bold text-ink-900 break-before-page">SCHEDULE III</h3>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-500">Scope of Operations &amp; Maintenance and AMC</p>
        {AGREEMENT_SCHEDULE_III.map((s) => (
          <div key={s.number} className="mt-4">
            <h4 className="text-sm font-bold text-ink-900">{s.number}. {s.heading}</h4>
            {s.paragraphs.map((p, pi) => <p key={pi} className="mt-2 text-sm leading-relaxed text-ink-700">{p}</p>)}
          </div>
        ))}

        {/* Schedule IV */}
        <h3 className="mt-8 text-center text-sm font-bold text-ink-900 break-before-page">SCHEDULE IV</h3>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-500">{AGREEMENT_SCHEDULE_IV.heading}</p>
        {AGREEMENT_SCHEDULE_IV.paragraphs.map((p, pi) => <p key={pi} className="mt-2 text-sm leading-relaxed text-ink-700">{p}</p>)}

        {/* Annexure */}
        <h3 className="mt-8 text-center text-sm font-bold text-ink-900 break-before-page">ANNEXURE</h3>
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-ink-500">{AGREEMENT_ANNEXURE_A_HEADING}</p>
        <p className="mt-1 text-center text-xs italic text-ink-500">{AGREEMENT_ANNEXURE_A_SUBTITLE}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-700">{AGREEMENT_ANNEXURE_A_INTRO}</p>
        {AGREEMENT_ANNEXURE_A_PARAGRAPHS.map((p, pi) => <p key={pi} className="mt-2 text-sm leading-relaxed text-ink-700">{p}</p>)}

        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-ink-300 bg-ink-50">
              <th className="w-10 px-2 py-1.5 text-left font-semibold">S.No.</th>
              <th className="px-2 py-1.5 text-left font-semibold">Equipment</th>
              <th className="w-40 px-2 py-1.5 text-left font-semibold">Serial Number</th>
            </tr>
          </thead>
          <tbody>
            {annexureItems.length === 0 ? (
              <tr><td colSpan={3} className="px-2 py-2 text-ink-500">No equipment recorded on Schedule II yet.</td></tr>
            ) : annexureItems.map((row, i) => (
              <tr key={row.id} className="border-b border-ink-200">
                <td className="px-2 py-1.5 tabular-nums">{i + 1}</td>
                <td className="px-2 py-1.5">{row.description || "—"}</td>
                <td className="px-2 py-1.5">{row.serialNo || "—"}</td>
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

  function patchSiteHolder(siteHolder: AgreementSiteHolder) {
    setDraft((d) => {
      const base = d ?? lead.agreement;
      if (!base) return d;
      return { ...base, siteHolder };
    });
  }

  function patchPaymentModel(paymentModel: AgreementPaymentModel) {
    setDraft((d) => {
      const base = d ?? lead.agreement;
      if (!base) return d;
      return { ...base, paymentModel };
    });
  }

  // General patch for the live letter — Schedule I/II cells, recitals and
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
          onSiteHolder={patchSiteHolder}
          onPaymentModel={patchPaymentModel}
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
        subtitle={`${current.number} · ${AGREEMENT_STATUS_LABEL[current.status]} · Site Holder: ${AGREEMENT_SITE_HOLDER_LABEL[current.siteHolder]} · ${AGREEMENT_PAYMENT_MODEL_LABEL[current.paymentModel]}${dirty ? " · Unsaved changes" : ""}`}
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
            ? "Click any line below — recitals, clauses, Schedule I or Schedule II — to edit it directly, then Save changes."
            : "Recitals, clauses, Schedule I and Schedule II are seeded from Livanto's standard MASTER template and can be edited per lead."}
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

      <UploadedAgreementsCard lead={lead} actor={actor} viewer={viewer} canEdit={canEdit} />

      <Modal
        open={regenerateOpen}
        onClose={() => { setRegenerateOpen(false); setDraft(null); }}
        title="Edit Schedule I"
        description="Regenerating archives the current Agreement to Previous versions, then replaces it with these details under a new number."
        wide
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
        <ScheduleForm draft={draft} onPatch={patchSchedule} onSiteHolder={patchSiteHolder} onPaymentModel={patchPaymentModel} onFetch={fetchFromLead} />
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
  draft, onPatch, onSiteHolder, onPaymentModel, onFetch,
}: {
  draft: AgreementDoc | null;
  onPatch: (key: AgreementScheduleKey, value: string) => void;
  onSiteHolder: (siteHolder: AgreementSiteHolder) => void;
  onPaymentModel: (paymentModel: AgreementPaymentModel) => void;
  onFetch?: () => void;
}) {
  if (!draft) return null;
  const fields = AGREEMENT_SCHEDULE_FIELDS.filter((f) => f.part !== "C" || partCFields(draft.paymentModel).includes(f));
  return (
    <div className="space-y-4">
      {onFetch && (
        <Button size="sm" onClick={onFetch} title="Pull fresh values from this lead's Letter of Intent, client and site details — fields with no source there are left as they are.">
          <Download className="h-3.5 w-3.5" /> Fetch from EOI / lead
        </Button>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site Holder (Schedule I, Part A)">
          <Select
            value={draft.siteHolder}
            onChange={(e) => onSiteHolder(e.target.value as AgreementSiteHolder)}
            options={AGREEMENT_SITE_HOLDERS.map((s) => ({ value: s, label: AGREEMENT_SITE_HOLDER_LABEL[s] }))}
          />
        </Field>
        <Field label="Selected Payment Model (Schedule I, Part C)">
          <Select
            value={draft.paymentModel}
            onChange={(e) => onPaymentModel(e.target.value as AgreementPaymentModel)}
            options={AGREEMENT_PAYMENT_MODELS.map((m) => ({ value: m, label: AGREEMENT_PAYMENT_MODEL_LABEL[m] }))}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
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
  open, draft, onClose, onPatch, onSiteHolder, onPaymentModel, onFetch, onSave, busy,
}: {
  open: boolean;
  draft: AgreementDoc | null;
  onClose: () => void;
  onPatch: (key: AgreementScheduleKey, value: string) => void;
  onSiteHolder: (siteHolder: AgreementSiteHolder) => void;
  onPaymentModel: (paymentModel: AgreementPaymentModel) => void;
  onFetch?: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Draft the Franchise Agreement"
      description="Fill in Schedule I, pick the Site Holder and Payment Model — the 27 standard clauses need no editing, and Schedule II is auto-seeded from the quote."
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
      <ScheduleForm draft={draft} onPatch={onPatch} onSiteHolder={onSiteHolder} onPaymentModel={onPaymentModel} onFetch={onFetch} />
    </Modal>
  );
}

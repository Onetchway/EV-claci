"use client";

import { Clock, FileText, Plus, Printer, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea,
  useAsyncAction,
} from "@/components/ui";
import {
  EOI_STATUSES, EOI_STATUS_COLOR, EOI_STATUS_LABEL, type EoiStatus,
} from "@/lib/constants";
import {
  issueEoi, nextEoiNumber, regenerateEoi, saveEoi, setEoiStatus, subscribeEoiVersions,
} from "@/lib/db/leads";
import { buildEoiFromLead, scheduleTotal } from "@/lib/eoi";
import { useSettings } from "@/hooks/use-settings";
import { canIssueEoi, type Viewer } from "@/lib/permissions";
import type { Actor, AppSettings, EoiDoc, EoiScheduleRow, EoiVersion, Lead } from "@/lib/types";
import { cn, formatDate, formatDateTime, formatINR } from "@/lib/utils";

/**
 * Draft, edit, print. The letter is generated from the quotation but every
 * field stays editable, because the real letters differ deal by deal.
 *
 * Printing goes through the browser's own print dialog rather than a PDF
 * library: "Save as PDF" is built into every browser, the output uses real
 * text (so it stays searchable and selectable), and it avoids shipping a
 * megabyte of PDF tooling to render one page.
 *
 * Regenerating (client name/address changed, config changed, a fresh round
 * of negotiation, etc.) archives whatever letter is currently live to
 * leads/{id}/eoiVersions before replacing it, rather than overwriting it in
 * place — a letter a signatory has already seen stays retrievable and
 * printable even after a newer one supersedes it.
 */

export function EoiPanel({
  lead, actor, viewer, canEdit,
}: {
  lead: Lead;
  actor: Actor;
  viewer: Viewer;
  canEdit: boolean;
}) {
  const [draft, setDraft] = useState<EoiDoc | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [gstSeparate, setGstSeparate] = useState(true);
  const [extraEquipment, setExtraEquipment] = useState("");
  const [versions, setVersions] = useState<EoiVersion[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<EoiVersion | null>(null);
  const { busy, run } = useAsyncAction();
  const { settings } = useSettings();
  const company = settings.company;

  useEffect(() => subscribeEoiVersions(lead.id, setVersions), [lead.id]);

  const eoi = draft ?? lead.eoi ?? null;
  const dirty = draft !== null;
  const total = useMemo(() => (eoi ? scheduleTotal(eoi.schedule) : 0), [eoi]);

  function patch(p: Partial<EoiDoc>) {
    if (!eoi) return;
    setDraft({ ...eoi, ...p });
  }

  async function create() {
    const number = await nextEoiNumber();
    const built = buildEoiFromLead(lead, {
      number,
      gstShownSeparately: gstSeparate,
      extraEquipment: extraEquipment.trim() || undefined,
      settings,
    });
    await saveEoi(lead, built, actor);
    setDraft(null);
    setCreateOpen(false);
    setExtraEquipment("");
  }

  async function regenerate() {
    const number = await nextEoiNumber();
    const built = buildEoiFromLead(lead, {
      number,
      gstShownSeparately: gstSeparate,
      extraEquipment: extraEquipment.trim() || undefined,
      settings,
    });
    await regenerateEoi(lead, built, actor);
    setDraft(null);
    setRegenerateOpen(false);
    setExtraEquipment("");
  }

  if (viewingVersion) {
    return (
      <div className="space-y-4">
        <Card className="print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                {viewingVersion.number}
                <Badge className="bg-ink-100 text-ink-600 ring-ink-200">Archived version</Badge>
                <Badge className={EOI_STATUS_COLOR[viewingVersion.status]}>{EOI_STATUS_LABEL[viewingVersion.status]}</Badge>
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                Superseded {formatDateTime(viewingVersion.archivedAt)} by {viewingVersion.archivedBy?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </Button>
              <Button variant="primary" onClick={() => setViewingVersion(null)}>Back to current letter</Button>
            </div>
          </div>
        </Card>

        <LoiLetterArticle eoi={viewingVersion} company={company} bank={settings.bank} readOnly onPatch={() => undefined} />
      </div>
    );
  }

  if (!eoi) {
    return (
      <>
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No Letter of Intent yet"
          description="Generate one from this lead's quotation. Every line stays editable before you issue it."
          action={
            canEdit ? (
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Draft Letter of Intent
              </Button>
            ) : undefined
          }
        />

        {versions.length > 0 && (
          <Card title="Previous versions" subtitle={`${versions.length} archived letter${versions.length === 1 ? "" : "s"} on this lead.`}>
            <VersionList versions={versions} onView={setViewingVersion} />
          </Card>
        )}

        <CreateOrRegenerateModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Draft Letter of Intent"
          description="Built from the charger configuration and payment schedule on this lead."
          confirmLabel="Generate draft"
          gstSeparate={gstSeparate}
          setGstSeparate={setGstSeparate}
          extraEquipment={extraEquipment}
          setExtraEquipment={setExtraEquipment}
          hasConfig={(lead.config ?? []).length > 0}
          busy={busy}
          onConfirm={() => void run(create, "Letter drafted.")}
        />
      </>
    );
  }

  const readOnly = !canEdit || eoi.status === "ACCEPTED";

  return (
    <div className="space-y-4">
      {/* Toolbar — hidden when printing */}
      <Card className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              {eoi.number}
              <Badge className={EOI_STATUS_COLOR[eoi.status]}>{EOI_STATUS_LABEL[eoi.status]}</Badge>
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {eoi.issuedDate ? `Issued ${formatDate(eoi.issuedDate)}` : "Not yet issued"}
              {dirty && <span className="ml-2 font-medium text-amber-700">Unsaved changes</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {versions.length > 0 && (
              <Button onClick={() => setVersionsOpen(true)}>
                <Clock className="h-4 w-4" /> Previous versions ({versions.length})
              </Button>
            )}

            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </Button>

            {canEdit && (
              <Button
                variant={dirty ? "primary" : "secondary"}
                disabled={!dirty}
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    if (draft) await saveEoi(lead, draft, actor);
                    setDraft(null);
                  }, "Letter saved.")
                }
              >
                Save changes
              </Button>
            )}

            {canEdit && (
              <Button
                onClick={() => setRegenerateOpen(true)}
                title="Rebuild the letter from this lead's current client, site and quotation details — the current letter is archived first, not lost."
              >
                Regenerate
              </Button>
            )}

            {canIssueEoi(viewer) && eoi.status === "DRAFT" && (
              <Button
                variant="primary"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    if (draft) await saveEoi(lead, draft, actor);
                    await issueEoi(lead, actor);
                    setDraft(null);
                  }, "Letter issued.")
                }
              >
                <Send className="h-4 w-4" /> Mark issued
              </Button>
            )}

            {canIssueEoi(viewer) && eoi.status !== "DRAFT" && (
              <Select
                value={eoi.status}
                onChange={(e) => void run(() => setEoiStatus(lead, e.target.value as EoiStatus, actor), "Status updated.")}
                className="w-auto"
                options={EOI_STATUSES.map((s) => ({ value: s, label: EOI_STATUS_LABEL[s] }))}
              />
            )}
          </div>
        </div>

        {total !== eoi.totalAmount && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            The schedule rows add up to <strong>{formatINR(total)}</strong>, but the total line says{" "}
            <strong>{formatINR(eoi.totalAmount)}</strong>.{" "}
            {canEdit && (
              <button
                type="button"
                onClick={() => patch({ totalAmount: total })}
                className="font-semibold underline"
              >
                Set the total to {formatINR(total)}
              </button>
            )}
          </p>
        )}
      </Card>

      <LoiLetterArticle eoi={eoi} company={company} bank={settings.bank} readOnly={readOnly} onPatch={patch} />

      <CreateOrRegenerateModal
        open={regenerateOpen}
        onClose={() => setRegenerateOpen(false)}
        title="Regenerate Letter of Intent"
        description={`This archives the current letter (${eoi.number}) and builds a fresh one from this lead's current client, site and quotation details. The archived copy stays available under "Previous versions."`}
        confirmLabel="Regenerate"
        gstSeparate={gstSeparate}
        setGstSeparate={setGstSeparate}
        extraEquipment={extraEquipment}
        setExtraEquipment={setExtraEquipment}
        hasConfig={(lead.config ?? []).length > 0}
        busy={busy}
        onConfirm={() => void run(regenerate, "Letter regenerated — the previous version is archived.")}
      />

      <Modal
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        title="Previous versions"
        description="Every letter this lead has had before the current one — each stays exactly as it was when superseded."
      >
        <VersionList versions={versions} onView={(v) => { setVersionsOpen(false); setViewingVersion(v); }} />
      </Modal>
    </div>
  );
}

function VersionList({ versions, onView }: { versions: EoiVersion[]; onView: (v: EoiVersion) => void }) {
  if (versions.length === 0) return <p className="text-sm text-ink-500">No archived versions yet.</p>;
  return (
    <div className="divide-y divide-ink-100">
      {versions.map((v) => (
        <div key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <div>
            <p className="font-medium text-ink-900">
              {v.number} <Badge className={cn("ml-1", EOI_STATUS_COLOR[v.status])}>{EOI_STATUS_LABEL[v.status]}</Badge>
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {v.investorName} · {formatINR(v.totalAmount)} · superseded {formatDateTime(v.archivedAt)} by {v.archivedBy?.name}
            </p>
          </div>
          <Button size="sm" onClick={() => onView(v)}>View / Print</Button>
        </div>
      ))}
    </div>
  );
}

function CreateOrRegenerateModal({
  open, onClose, title, description, confirmLabel, gstSeparate, setGstSeparate,
  extraEquipment, setExtraEquipment, hasConfig, busy, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  gstSeparate: boolean;
  setGstSeparate: (v: boolean) => void;
  extraEquipment: string;
  setExtraEquipment: (v: string) => void;
  hasConfig: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="How should GST appear?">
          <Select
            value={gstSeparate ? "SEPARATE" : "INCLUSIVE"}
            onChange={(e) => setGstSeparate(e.target.value === "SEPARATE")}
            options={[
              { value: "SEPARATE", label: "As its own row in the summary" },
              { value: "INCLUSIVE", label: "Folded into each tranche amount" },
            ]}
          />
        </Field>
        <Field
          label="Complimentary or bundled equipment"
          hint="Appears in the subject line and scope, e.g. “one complimentary 7.4 kW AC Charger”."
        >
          <Input
            value={extraEquipment}
            onChange={(e) => setExtraEquipment(e.target.value)}
            placeholder="Leave blank if none"
          />
        </Field>
        {!hasConfig && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            This lead has no charger configuration yet, so the letter will have no amounts. Add
            the configuration first for a usable draft.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// The letter itself — this is what prints. Shared between the live editable
// letter and a read-only archived version.
// ---------------------------------------------------------------------------

function LoiLetterArticle({
  eoi, company, bank, readOnly, onPatch,
}: {
  eoi: EoiDoc;
  company: AppSettings["company"];
  bank: AppSettings["bank"];
  readOnly: boolean;
  onPatch: (p: Partial<EoiDoc>) => void;
}) {
  function patchRow(id: string, p: Partial<EoiScheduleRow>) {
    onPatch({ schedule: eoi.schedule.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  }

  return (
    <article className="loi-sheet rounded-xl border border-ink-200 bg-white p-8 shadow-card print:border-0 print:p-0 print:shadow-none">
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-ink-200 pb-4">
        {company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={company.logoUrl}
            alt={company.shortName}
            width={197}
            height={40}
            className="h-10 w-auto shrink-0"
          />
        ) : (
          <p className="text-lg font-bold tracking-tight text-ink-900">{company.legalName}</p>
        )}
        <div className="text-right">
          <p className="text-xs text-ink-500">Letter of Intent cum Expression of Interest · {eoi.number}</p>
          {(company.email || company.website) && (
            <p className="mt-1 text-[11px] text-ink-400">
              {company.email}
              {company.email && company.website && <> &nbsp;|&nbsp; </>}
              {company.website}
            </p>
          )}
        </div>
      </div>

      <EditableLine
        readOnly={readOnly}
        label="Date"
        value={eoi.issuedDate ? formatDate(eoi.issuedDate) : formatDate(new Date())}
        onChange={() => undefined}
        staticText
      />

      <div className="mt-4">
        <p className="text-sm text-ink-700">To,</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-1">
          <EditableInline
            readOnly={readOnly}
            value={eoi.salutation}
            onChange={(v) => onPatch({ salutation: v })}
            className="w-14 font-semibold"
            aria-label="Salutation"
          />
          <EditableInline
            readOnly={readOnly}
            value={eoi.investorName}
            onChange={(v) => onPatch({ investorName: v })}
            className="min-w-[220px] flex-1 font-semibold"
            aria-label="Investor name"
          />
        </div>
        <EditableBlock
          readOnly={readOnly}
          value={eoi.investorAddress}
          onChange={(v) => onPatch({ investorAddress: v })}
          rows={2}
          placeholder="Complete address"
          className="mt-1 text-sm"
        />
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-ink-900">Subject:</p>
        <EditableBlock
          readOnly={readOnly}
          value={eoi.subject}
          onChange={(v) => onPatch({ subject: v })}
          rows={2}
          className="text-sm font-medium"
        />
      </div>

      <p className="mt-5 text-sm">Dear {eoi.salutation} {eoi.investorName.split(" ").slice(-1)[0]},</p>

      <EditableBlock
        readOnly={readOnly}
        value={eoi.intro}
        onChange={(v) => onPatch({ intro: v })}
        rows={4}
        className="mt-2 text-sm leading-relaxed"
      />

      {/* Participation summary */}
      <h2 className="mt-6 text-sm font-bold text-ink-900 break-after-avoid">Participation Summary</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-ink-300 bg-ink-50 break-inside-avoid">
            <th className="w-12 px-2 py-1.5 text-left font-semibold">S.No.</th>
            <th className="px-2 py-1.5 text-left font-semibold">Description</th>
            <th className="w-40 px-2 py-1.5 text-right font-semibold">Amount (Rs.)</th>
            {!readOnly && <th className="w-8 print:hidden" />}
          </tr>
        </thead>
        <tbody>
          {eoi.schedule.map((row, i) => (
            <tr key={row.id} className="border-b border-ink-200 align-top break-inside-avoid">
              <td className="px-2 py-1.5 tabular-nums">{i + 1}</td>
              <td className="px-2 py-1.5">
                <EditableBlock
                  readOnly={readOnly}
                  value={row.description}
                  onChange={(v) => patchRow(row.id, { description: v })}
                  rows={2}
                  className="text-sm"
                />
              </td>
              <td className="px-2 py-1.5 text-right">
                {readOnly ? (
                  <span className="tabular-nums">{formatINR(row.amount)}</span>
                ) : (
                  <input
                    type="number"
                    value={row.amount || ""}
                    onChange={(e) => patchRow(row.id, { amount: Number(e.target.value) || 0 })}
                    className="input py-1 text-right text-sm tabular-nums print:border-0"
                    aria-label={`Amount for row ${i + 1}`}
                  />
                )}
              </td>
              {!readOnly && (
                <td className="px-1 py-1.5 print:hidden">
                  <button
                    type="button"
                    onClick={() => onPatch({ schedule: eoi.schedule.filter((r) => r.id !== row.id) })}
                    className="rounded p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Remove row ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
          <tr className="border-b-2 border-ink-400 font-bold break-inside-avoid">
            <td />
            <td className="px-2 py-2">Total Participation Amount</td>
            <td className="px-2 py-2 text-right tabular-nums">{formatINR(eoi.totalAmount)}</td>
            {!readOnly && <td className="print:hidden" />}
          </tr>
        </tbody>
      </table>

      {!readOnly && (
        <button
          type="button"
          onClick={() =>
            onPatch({
              schedule: [
                ...eoi.schedule,
                { id: `s${Date.now()}`, description: "", amount: 0 },
              ],
            })
          }
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline print:hidden"
        >
          <Plus className="h-3 w-3" /> Add a row
        </button>
      )}

      {/* Site & funding details — pulled from the lead at generation time, editable like everything else */}
      {(!readOnly || eoi.siteLocationProvider || eoi.siteLandType || eoi.siteCompensation || eoi.siteMapsLink || eoi.amountFinanced || eoi.subsidyAmount) && (
        <>
          <h2 className="mt-6 text-sm font-bold text-ink-900 break-after-avoid">Site & Funding Details</h2>
          <table className="mt-2 w-full border-collapse text-sm">
            <tbody>
              <tr className="border-y border-ink-200 break-inside-avoid">
                <td className="w-1/2 bg-ink-50 px-2 py-1.5 font-medium">Location</td>
                <td className="px-2 py-1.5">
                  <EditableInline
                    readOnly={readOnly}
                    value={eoi.siteName}
                    onChange={(v) => onPatch({ siteName: v })}
                    className="w-full"
                    aria-label="Site location"
                  />
                </td>
              </tr>
              {(eoi.siteLocationProvider || !readOnly) && (
                <tr className="border-b border-ink-200 break-inside-avoid">
                  <td className="bg-ink-50 px-2 py-1.5 font-medium">Location Provider</td>
                  <td className="px-2 py-1.5">
                    <EditableInline
                      readOnly={readOnly}
                      value={eoi.siteLocationProvider ?? ""}
                      onChange={(v) => onPatch({ siteLocationProvider: v })}
                      className="w-full"
                      aria-label="Location provider"
                    />
                  </td>
                </tr>
              )}
              {(eoi.siteLandType || !readOnly) && (
                <tr className="border-b border-ink-200 break-inside-avoid">
                  <td className="bg-ink-50 px-2 py-1.5 font-medium">Land Type</td>
                  <td className="px-2 py-1.5">
                    <EditableInline
                      readOnly={readOnly}
                      value={eoi.siteLandType ?? ""}
                      onChange={(v) => onPatch({ siteLandType: v })}
                      className="w-full"
                      aria-label="Land type"
                    />
                  </td>
                </tr>
              )}
              {(eoi.siteCompensation || !readOnly) && (
                <tr className="border-b border-ink-200 break-inside-avoid">
                  <td className="bg-ink-50 px-2 py-1.5 font-medium">Site Compensation</td>
                  <td className="px-2 py-1.5">
                    <EditableInline
                      readOnly={readOnly}
                      value={eoi.siteCompensation ?? ""}
                      onChange={(v) => onPatch({ siteCompensation: v })}
                      className="w-full"
                      aria-label="Site compensation"
                    />
                  </td>
                </tr>
              )}
              {(eoi.siteMapsLink || !readOnly) && (
                <tr className="border-b border-ink-200 break-inside-avoid">
                  <td className="bg-ink-50 px-2 py-1.5 font-medium">Google Maps Link</td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      eoi.siteMapsLink ? (
                        <a href={eoi.siteMapsLink} target="_blank" rel="noreferrer" className="text-brand-700 underline break-all">
                          {eoi.siteMapsLink}
                        </a>
                      ) : null
                    ) : (
                      <EditableInline
                        readOnly={false}
                        value={eoi.siteMapsLink ?? ""}
                        onChange={(v) => onPatch({ siteMapsLink: v })}
                        className="w-full break-all"
                        aria-label="Google Maps link"
                      />
                    )}
                  </td>
                </tr>
              )}
              {(eoi.amountFinanced ? eoi.amountFinanced > 0 : false) || !readOnly ? (
                <tr className="border-b border-ink-200 break-inside-avoid">
                  <td className="bg-ink-50 px-2 py-1.5 font-medium">Amount to be Financed</td>
                  <td className="px-2 py-1.5">
                    Rs.{" "}
                    <EditableNumber
                      readOnly={readOnly}
                      value={eoi.amountFinanced ?? 0}
                      onChange={(v) => onPatch({ amountFinanced: v })}
                      className="w-28"
                      aria-label="Amount to be financed"
                    />
                  </td>
                </tr>
              ) : null}
              {(eoi.subsidyAmount ? eoi.subsidyAmount > 0 : false) || !readOnly ? (
                <tr className="border-b border-ink-200 break-inside-avoid">
                  <td className="bg-ink-50 px-2 py-1.5 font-medium">Subsidy</td>
                  <td className="px-2 py-1.5">
                    Rs.{" "}
                    <EditableNumber
                      readOnly={readOnly}
                      value={eoi.subsidyAmount ?? 0}
                      onChange={(v) => onPatch({ subsidyAmount: v })}
                      className="w-28"
                      aria-label="Subsidy amount"
                    />
                    {" "}(
                    <EditableNumber
                      readOnly={readOnly}
                      value={eoi.subsidyPct ?? 0}
                      onChange={(v) => onPatch({ subsidyPct: v })}
                      className="w-14"
                      aria-label="Subsidy percentage"
                    />
                    %)
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </>
      )}

      {/* Scope */}
      <h2 className="mt-6 text-sm font-bold text-ink-900 break-after-avoid">Scope of {company.shortName}&apos;s Obligations</h2>
      <ul className="mt-2 space-y-1">
        {eoi.scopeItems.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm break-inside-avoid">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-700" />
            <EditableInline
              readOnly={readOnly}
              value={item}
              onChange={(v) => onPatch({ scopeItems: eoi.scopeItems.map((s, j) => (j === i ? v : s)) })}
              className="flex-1"
              aria-label={`Scope item ${i + 1}`}
            />
            {!readOnly && (
              <button
                type="button"
                onClick={() => onPatch({ scopeItems: eoi.scopeItems.filter((_, j) => j !== i) })}
                className="rounded p-0.5 text-ink-300 hover:text-rose-600 print:hidden"
                aria-label={`Remove scope item ${i + 1}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <button
          type="button"
          onClick={() => onPatch({ scopeItems: [...eoi.scopeItems, ""] })}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline print:hidden"
        >
          <Plus className="h-3 w-3" /> Add scope item
        </button>
      )}

      {/* Tenure & payout */}
      <h2 className="mt-6 text-sm font-bold text-ink-900 break-after-avoid">Project Tenure</h2>
      <p className="mt-1 text-sm leading-relaxed">
        The Charging Station shall operate for a minimum of{" "}
        <EditableNumber
          readOnly={readOnly}
          value={eoi.tenureYears}
          onChange={(v) => onPatch({ tenureYears: v })}
          className="w-14"
          aria-label="Tenure years"
        />{" "}
        years from the date of commercial commissioning, extendable by mutual written agreement
        between the parties, and shall be operated exclusively by {company.shortName} throughout the Tenure.
      </p>

      <h2 className="mt-6 text-sm font-bold text-ink-900 break-after-avoid">Minimum Monthly Payout</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <tbody>
          <tr className="border-y border-ink-200 break-inside-avoid">
            <td className="w-1/2 bg-ink-50 px-2 py-1.5 font-medium">Payout Period</td>
            <td className="px-2 py-1.5">
              <EditableNumber
                readOnly={readOnly}
                value={eoi.payoutMonths}
                onChange={(v) => onPatch({ payoutMonths: v, maxAggregateSupport: v * eoi.minMonthlyPayout })}
                className="w-16"
                aria-label="Payout months"
              />{" "}
              months from the Commercial Commissioning Date
            </td>
          </tr>
          <tr className="border-b border-ink-200 break-inside-avoid">
            <td className="bg-ink-50 px-2 py-1.5 font-medium">Minimum Monthly Payout</td>
            <td className="px-2 py-1.5">
              Rs.{" "}
              <EditableNumber
                readOnly={readOnly}
                value={eoi.minMonthlyPayout}
                onChange={(v) => onPatch({ minMonthlyPayout: v, maxAggregateSupport: v * eoi.payoutMonths })}
                className="w-28"
                aria-label="Minimum monthly payout"
              />{" "}
              per month
            </td>
          </tr>
          <tr className="border-b border-ink-200 break-inside-avoid">
            <td className="bg-ink-50 px-2 py-1.5 font-medium">Maximum Aggregate Support</td>
            <td className="px-2 py-1.5 tabular-nums">
              {formatINR(eoi.maxAggregateSupport)} in aggregate across the Payout Period
            </td>
          </tr>
        </tbody>
      </table>

      {/* Bank details */}
      <h2 className="mt-6 text-sm font-bold text-ink-900 break-after-avoid">Bank Details for Remittance</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <tbody>
          {[
            ["Account Name", bank.accountName],
            ["Bank Name", bank.bankName],
            ["Account Number", bank.accountNumber],
            ["IFSC Code", bank.ifsc],
          ].map(([k, v]) => (
            <tr key={k} className="border-b border-ink-200">
              <td className="w-1/2 bg-ink-50 px-2 py-1.5 font-medium">{k}</td>
              <td className="px-2 py-1.5">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Terms */}
      <h2 className="mt-6 text-sm font-bold text-ink-900 break-after-avoid">Terms and Conditions</h2>
      <ol className="mt-2 space-y-2.5">
        {eoi.clauses.map((c, i) => (
          <li key={c.key} className="text-sm leading-relaxed break-inside-avoid">
            <span className="font-semibold">{i + 1}. {c.heading} — </span>
            <EditableInline
              readOnly={readOnly}
              value={c.body}
              onChange={(v) =>
                onPatch({ clauses: eoi.clauses.map((x, j) => (j === i ? { ...x, body: v } : x)) })
              }
              multiline
              aria-label={`Clause ${i + 1}`}
            />
          </li>
        ))}
      </ol>

      <EditableBlock
        readOnly={readOnly}
        value={eoi.closing}
        onChange={(v) => onPatch({ closing: v })}
        rows={3}
        className="mt-6 text-sm leading-relaxed"
      />

      <div className="mt-8">
        <p className="text-sm">For {company.legalName}</p>
        <p className="mt-8 text-sm font-semibold">{eoi.signatory}</p>
      </div>

      <div className="mt-10 grid gap-8 border-t border-ink-200 pt-6 sm:grid-cols-2">
        <div>
          <p className="text-xs text-ink-500">Accepted and agreed</p>
          <div className="mt-10 border-t border-ink-400 pt-1 text-xs">
            {eoi.salutation} {eoi.investorName}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-500">Date</p>
          <div className="mt-10 border-t border-ink-400 pt-1 text-xs">&nbsp;</div>
        </div>
      </div>

      <footer className="mt-10 border-t border-ink-200 pt-3 text-center text-[10px] leading-relaxed text-ink-400">
        <p>{company.legalName}</p>
        <p>
          {[company.gstin && `GSTN. ${company.gstin}`, company.cin && `CIN. ${company.cin}`]
            .filter(Boolean)
            .join(" | ")}
        </p>
        <p>Registered address: {company.registeredAddress}</p>
        <p>Office address: {company.officeAddress}</p>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Inline editing primitives — they look like plain text until focused, so the
// letter reads as a letter rather than as a form.
// ---------------------------------------------------------------------------

const INLINE =
  "rounded border border-transparent bg-transparent px-1 hover:border-ink-200 hover:bg-ink-50 " +
  "focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 " +
  "print:border-0 print:bg-transparent print:px-0";

function EditableInline({
  value, onChange, readOnly, className, multiline, ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  className?: string;
  multiline?: boolean;
} & React.AriaAttributes) {
  if (readOnly) return <span className={className}>{value}</span>;
  if (multiline) {
    return (
      <textarea
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(2, Math.ceil(value.length / 110))}
        className={cn(INLINE, "w-full resize-y align-top text-sm leading-relaxed", className)}
      />
    );
  }
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(INLINE, "text-sm", className)}
    />
  );
}

function EditableBlock({
  value, onChange, readOnly, rows = 3, className, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  rows?: number;
  className?: string;
  placeholder?: string;
}) {
  if (readOnly) return <p className={cn("whitespace-pre-wrap", className)}>{value}</p>;
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className={cn(INLINE, "w-full resize-y", className)}
    />
  );
}

function EditableNumber({
  value, onChange, readOnly, className, ...rest
}: {
  value: number;
  onChange: (v: number) => void;
  readOnly?: boolean;
  className?: string;
} & React.AriaAttributes) {
  if (readOnly) return <span className="tabular-nums">{value.toLocaleString("en-IN")}</span>;
  return (
    <input
      {...rest}
      type="number"
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={cn(INLINE, "text-sm tabular-nums", className)}
    />
  );
}

function EditableLine({
  label, value, staticText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  staticText?: boolean;
}) {
  return (
    <p className="text-sm">
      <span className="font-semibold">{label}: </span>
      {staticText ? value : value}
    </p>
  );
}

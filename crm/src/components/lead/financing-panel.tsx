"use client";

import { Banknote, Link2, Unlink } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  Badge, Button, Card, Field, Input, Modal, ProgressBar, Select, Textarea,
  useAsyncAction,
} from "@/components/ui";
import {
  BANKS, FUNDING_MODES, FUNDING_MODE_LABEL, LEAD_TYPE_LABEL, LOAN_STAGES,
  LOAN_STAGE_COLOR, LOAN_STAGE_LABEL,
  type FundingMode, type LoanStage,
} from "@/lib/constants";
import {
  DEFAULT_FINANCING, findLinkCandidates, linkLeads, unlinkLead, updateFinancing,
} from "@/lib/db/leads";
import { canEditFinancing, canLinkLeads, type Viewer } from "@/lib/permissions";
import { emiFor } from "@/lib/pricing";
import type { Actor, FinancingInfo, Lead } from "@/lib/types";
import { formatINR, toDate } from "@/lib/utils";

const toInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const fromInput = (s: string) => (s ? new Date(`${s}T00:00:00`) : null);

/**
 * Bank funding and the site ↔ franchise pairing.
 *
 * Loan progress is tracked as its own stage rather than folded into the sales
 * pipeline: a lead can be at Agreement while the loan is still under review,
 * and collapsing the two would hide exactly the delay you need to see.
 */
export function FinancingPanel({
  lead, actor, viewer, canEdit,
}: {
  lead: Lead;
  actor: Actor;
  viewer: Viewer;
  canEdit: boolean;
}) {
  const stored = lead.financing ?? DEFAULT_FINANCING;
  const [form, setForm] = useState<FinancingInfo>(stored);
  const [linkOpen, setLinkOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const { busy, run } = useAsyncAction();

  // Re-sync when another user edits the same lead.
  useEffect(() => setForm(lead.financing ?? DEFAULT_FINANCING), [lead.financing]);

  const editable = canEdit && canEditFinancing(viewer);
  const dirty = JSON.stringify(form) !== JSON.stringify(stored);
  const usesLoan = form.mode !== "SELF";

  const set = <K extends keyof FinancingInfo>(k: K, v: FinancingInfo[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const estimatedEmi = useMemo(() => {
    const p = form.sanctionedAmount ?? form.requestedAmount ?? 0;
    const r = (form.interestRate ?? 9) / 100;
    const y = form.tenureYears ?? 5;
    return p > 0 && y > 0 ? emiFor(p, r, y) : 0;
  }, [form.sanctionedAmount, form.requestedAmount, form.interestRate, form.tenureYears]);

  const coverage = lead.value > 0 ? Math.min(100, ((form.sanctionedAmount ?? 0) / lead.value) * 100) : 0;

  useEffect(() => {
    if (!linkOpen) return;
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await findLinkCandidates(lead, search);
        if (!cancelled) setCandidates(rows);
      } catch {
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [linkOpen, search, lead]);

  return (
    <div className="space-y-4">
      <Card
        title="Funding"
        subtitle="How the investor is paying for their participation."
        actions={
          editable && dirty ? (
            <Button
              variant="primary"
              size="sm"
              loading={busy}
              onClick={() => void run(() => updateFinancing(lead, form, actor), "Financing saved.")}
            >
              Save
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Funding mode" required>
            <Select
              value={form.mode}
              disabled={!editable}
              onChange={(e) => {
                const mode = e.target.value as FundingMode;
                setForm((f) => ({
                  ...f,
                  mode,
                  stage: mode === "SELF" ? "NOT_APPLICABLE" : f.stage === "NOT_APPLICABLE" ? "ENQUIRY" : f.stage,
                }));
              }}
              options={FUNDING_MODES.map((m) => ({ value: m, label: FUNDING_MODE_LABEL[m] }))}
            />
          </Field>

          {usesLoan && (
            <>
              <Field label="Loan stage">
                <Select
                  value={form.stage}
                  disabled={!editable}
                  onChange={(e) => set("stage", e.target.value as LoanStage)}
                  options={LOAN_STAGES.map((s) => ({ value: s, label: LOAN_STAGE_LABEL[s] }))}
                />
              </Field>

              <Field label="Bank / lender" hint="Type any name not in the list.">
                <Input
                  list="bank-list"
                  value={form.bank ?? ""}
                  disabled={!editable}
                  onChange={(e) => set("bank", e.target.value)}
                  placeholder="State Bank of India"
                />
                <datalist id="bank-list">
                  {BANKS.map((b) => <option key={b} value={b} />)}
                </datalist>
              </Field>

              <Field label="Branch">
                <Input value={form.branch ?? ""} disabled={!editable} onChange={(e) => set("branch", e.target.value)} />
              </Field>

              <Field label="Application number">
                <Input
                  value={form.applicationNo ?? ""}
                  disabled={!editable}
                  onChange={(e) => set("applicationNo", e.target.value)}
                />
              </Field>

              <Field
                label="CIBIL score"
                hint="Recorded manually from a bureau pull done elsewhere — not a live check."
              >
                <Input
                  type="number"
                  min={300}
                  max={900}
                  value={form.cibilScore ?? ""}
                  disabled={!editable}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cibilScore: e.target.value === "" ? null : Number(e.target.value),
                      cibilCheckedAt: e.target.value === "" ? f.cibilCheckedAt : (new Date() as never),
                    }))
                  }
                  placeholder="300–900"
                />
              </Field>

              <Field label="Amount requested">
                <Input
                  type="number"
                  min={0}
                  step={10000}
                  value={form.requestedAmount ?? ""}
                  disabled={!editable}
                  onChange={(e) => set("requestedAmount", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>

              <Field label="Amount sanctioned">
                <Input
                  type="number"
                  min={0}
                  step={10000}
                  value={form.sanctionedAmount ?? ""}
                  disabled={!editable}
                  onChange={(e) => set("sanctionedAmount", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>

              <Field label="Amount disbursed">
                <Input
                  type="number"
                  min={0}
                  step={10000}
                  value={form.disbursedAmount ?? ""}
                  disabled={!editable}
                  onChange={(e) => set("disbursedAmount", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>

              <Field label="Interest rate (% p.a.)">
                <Input
                  type="number"
                  min={0}
                  step={0.05}
                  value={form.interestRate ?? ""}
                  disabled={!editable}
                  onChange={(e) => set("interestRate", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>

              <Field label="Tenure (years)">
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={form.tenureYears ?? ""}
                  disabled={!editable}
                  onChange={(e) => set("tenureYears", e.target.value === "" ? null : Number(e.target.value))}
                />
              </Field>

              <Field label="Relationship manager">
                <Input
                  value={form.relationshipManager ?? ""}
                  disabled={!editable}
                  onChange={(e) => set("relationshipManager", e.target.value)}
                />
              </Field>

              <Field label="RM phone">
                <Input value={form.rmPhone ?? ""} disabled={!editable} onChange={(e) => set("rmPhone", e.target.value)} />
              </Field>

              <Field label="Applied on">
                <Input
                  type="date"
                  value={toInput(toDate(form.appliedAt))}
                  disabled={!editable}
                  onChange={(e) => set("appliedAt", fromInput(e.target.value) as never)}
                />
              </Field>

              <Field label="Sanctioned on">
                <Input
                  type="date"
                  value={toInput(toDate(form.sanctionedAt))}
                  disabled={!editable}
                  onChange={(e) => set("sanctionedAt", fromInput(e.target.value) as never)}
                />
              </Field>

              <Field label="Disbursed on">
                <Input
                  type="date"
                  value={toInput(toDate(form.disbursedAt))}
                  disabled={!editable}
                  onChange={(e) => set("disbursedAt", fromInput(e.target.value) as never)}
                />
              </Field>

              <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
                <Textarea
                  rows={2}
                  value={form.note ?? ""}
                  disabled={!editable}
                  onChange={(e) => set("note", e.target.value)}
                />
              </Field>
            </>
          )}
        </div>

        {usesLoan && (
          <div className="mt-4 grid gap-4 rounded-lg bg-ink-50 px-4 py-3 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Loan stage</p>
              <Badge className={`mt-1 ${LOAN_STAGE_COLOR[form.stage]}`}>{LOAN_STAGE_LABEL[form.stage]}</Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Indicative EMI</p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {estimatedEmi ? formatINR(estimatedEmi) : "—"}
                {estimatedEmi > 0 && (
                  <span className="ml-1 text-xs font-normal text-ink-500">
                    / mo over {form.tenureYears ?? 5} yr
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-500">Covers of total value</p>
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar pct={coverage} className="flex-1" />
                <span className="text-xs tabular-nums">{Math.round(coverage)}%</span>
              </div>
            </div>
          </div>
        )}

        {!usesLoan && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2.5 text-sm text-ink-600">
            <Banknote className="h-4 w-4 shrink-0 text-ink-400" />
            Self funded — no bank tracking needed. Switch the funding mode above if that changes.
          </p>
        )}
      </Card>

      <Card
        title={lead.type === "SITE" ? "Franchise investor(s) on this site" : "Site(s) this investor is backing"}
        subtitle={
          lead.type === "SITE"
            ? "An investor can back more than one franchise over time — every link is listed here."
            : "An investor can hold several franchises at once or over time — every linked site is listed here."
        }
        actions={
          canLinkLeads(viewer) && (
            <Button size="sm" variant="primary" onClick={() => setLinkOpen(true)}>
              <Link2 className="h-3.5 w-3.5" /> Link another lead
            </Button>
          )
        }
      >
        {(lead.linkedLeads ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-500">
            Not linked to {lead.type === "SITE" ? "a franchise investor" : "a site"} yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {(lead.linkedLeads ?? []).map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2.5">
                <Link href={`/leads/${l.id}`} className="min-w-0 flex-1 hover:text-brand-700">
                  <span className="block truncate text-sm font-medium text-ink-900">{l.name || "Lead"}</span>
                  <span className="block text-xs text-ink-500">{l.code}</span>
                </Link>
                {canLinkLeads(viewer) && (
                  <Button
                    size="sm"
                    loading={busy}
                    onClick={() => void run(() => unlinkLead(lead, l.id, actor), "Unlinked.")}
                  >
                    <Unlink className="h-3.5 w-3.5" /> Unlink
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={lead.type === "SITE" ? "Link a franchise investor" : "Link a site enquiry"}
        description="Both records will show the pairing, so either side of the deal is reachable from the other."
        wide
        footer={<Button onClick={() => setLinkOpen(false)}>Close</Button>}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, phone or city"
          className="mb-3"
        />
        {searching ? (
          <p className="py-6 text-center text-sm text-ink-500">Searching…</p>
        ) : candidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">
            No {lead.type === "SITE" ? "franchise investors" : "site enquiries"} match.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{c.client?.name}</p>
                  <p className="truncate text-xs text-ink-500">
                    {c.code} · {LEAD_TYPE_LABEL[c.type]} · {c.client?.city}
                    {c.site?.locationName ? ` · ${c.site.locationName}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  loading={busy}
                  onClick={() =>
                    void run(async () => {
                      await linkLeads(lead, c, actor);
                      setLinkOpen(false);
                    }, "Leads linked.")
                  }
                >
                  Link
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

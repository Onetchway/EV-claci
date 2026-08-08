/**
 * Builds a Letter of Intent from a lead's quotation.
 *
 * The result is a *starting point*, not the final letter — every field is
 * editable before issue. That is deliberate: the letters Livanto actually
 * sends vary in tranche count, in whether GST is broken out as its own row or
 * folded into the amounts, and in what equipment is bundled. Hard-coding one
 * shape would mean re-typing the letter outside the CRM, which is exactly the
 * problem this is meant to solve.
 */

import {
  COMPANY, DEFAULT_PAYOUT_MONTHS, DEFAULT_SCOPE_ITEMS, DEFAULT_TENURE_YEARS,
} from "./constants";
import {
  amountInWords, DEFAULT_CLOSING, defaultIntro, defaultSubject, LOI_CLAUSES,
  renderTemplate,
} from "./loi-template";
import { buildQuote, describeCapacity } from "./pricing";
import type { AppSettings, EoiDoc, EoiScheduleRow, Lead } from "./types";
import { formatINR } from "./utils";

/** "Mr." / "Ms." drive the pronoun used in the Investor Confirmations clause. */
export function pronounFor(salutation: string): { subject: string; object: string } {
  const s = (salutation || "").toLowerCase();
  if (s.startsWith("ms") || s.startsWith("mrs") || s.startsWith("smt")) {
    return { subject: "she", object: "her" };
  }
  if (s.startsWith("mr") || s.startsWith("shri")) return { subject: "he", object: "him" };
  return { subject: "the Investor", object: "the Investor" };
}

/** Prose version of the payment schedule, for the Payment Schedule clause. */
export function scheduleSentence(rows: EoiScheduleRow[]): string {
  const real = rows.filter((r) => r.amount > 0 && r.description.trim());
  if (!real.length) return "The Participation Amount shall be paid as mutually agreed in writing.";

  const parts = real.map((r) => {
    // Strip the leading label ("Advance — payable on…") down to its essence so
    // the sentence reads naturally rather than repeating the table verbatim.
    const [head, ...tail] = r.description.split("—");
    const name = head!.trim();
    const detail = tail.join("—").trim();
    return `${name} of ${formatINR(r.amount)}${detail ? `, ${detail.charAt(0).toLowerCase()}${detail.slice(1)}` : ""}`;
  });

  const count = ["", "one tranche", "two tranches", "three tranches", "four tranches", "five tranches"][
    Math.min(real.length, 5)
  ];
  return `The Participation Amount shall be paid in ${count}: ${parts.join("; ")}.`;
}

export interface BuildEoiOptions {
  number: string;
  /** Show GST as its own row instead of folding it into each tranche. */
  gstShownSeparately?: boolean;
  tenureYears?: number;
  payoutMonths?: number;
  extraEquipment?: string;
  /** Org settings from Settings → Company/Letter of Intent, when available. */
  settings?: AppSettings;
}

export function buildEoiFromLead(lead: Lead, opts: BuildEoiOptions): EoiDoc {
  const quote = buildQuote(lead.config ?? [], {
    discount: lead.discount ?? 0,
    extras: lead.extras ?? [],
  });

  const capacityLabel = describeCapacity(lead.config) || "DC";
  const gstSeparate = opts.gstShownSeparately ?? true;
  const tenureYears = opts.tenureYears ?? opts.settings?.loi.tenureYears ?? DEFAULT_TENURE_YEARS;
  const payoutMonths = opts.payoutMonths ?? opts.settings?.loi.payoutMonths ?? DEFAULT_PAYOUT_MONTHS;
  const shortName = opts.settings?.company.shortName?.trim() || COMPANY.shortName;
  const scopeItems = opts.settings?.loi.scopeItems?.length ? opts.settings.loi.scopeItems : DEFAULT_SCOPE_ITEMS;
  const signatory = opts.settings?.loi.signatory?.trim() || COMPANY.signatory;
  const closing = opts.settings?.loi.closing?.trim() || DEFAULT_CLOSING;

  const siteName =
    lead.site?.locationName?.trim() ||
    lead.linkedLeads?.[0]?.name?.trim() ||
    [lead.client?.city, lead.client?.state].filter(Boolean).join(", ") ||
    "the Investor's premises";

  // The schedule mirrors the quotation's milestones. When GST is broken out,
  // the tranches carry pre-GST figures and tax gets its own row — which is how
  // the 90 kW letters read.
  const schedule: EoiScheduleRow[] = quote.milestones
    .filter((m) => m.base > 0 || m.key === "EOI")
    .map((m, i) => ({
      id: `s${i}`,
      description: m.label,
      amount: gstSeparate ? m.base : m.total,
    }));

  if (gstSeparate && quote.gst > 0) {
    schedule.push({
      id: "sgst",
      description: `GST @ ${quote.effectiveGstPct.toFixed(0)}% on the above`,
      amount: quote.gst,
    });
  }

  const minMonthlyPayout = quote.projected.assuredMinMonthly;
  const maxAggregateSupport = minMonthlyPayout * payoutMonths;
  const pronoun = pronounFor(salutationFor(lead));

  const values: Record<string, string> = {
    company: shortName,
    investorName: lead.client?.name ?? "",
    participationAmount: formatINR(quote.grandTotal),
    participationWords: amountInWords(quote.grandTotal),
    scheduleSentence: scheduleSentence(schedule),
    tenureYears: String(tenureYears),
    payoutMonths: String(payoutMonths),
    minMonthlyPayout: formatINR(minMonthlyPayout),
    maxAggregate: formatINR(maxAggregateSupport),
    siteName,
    pronounSubject: pronoun.subject,
    kw: capacityLabel,
  };

  return {
    number: opts.number,
    status: "DRAFT",
    issuedDate: null,
    salutation: salutationFor(lead),
    investorName: lead.client?.name ?? "",
    investorAddress: addressFor(lead),
    siteName,
    capacityLabel,
    extraEquipment: opts.extraEquipment ?? "",
    subject: defaultSubject(capacityLabel, siteName, opts.extraEquipment),
    intro: defaultIntro(capacityLabel, opts.extraEquipment),
    schedule,
    totalAmount: quote.grandTotal,
    gstShownSeparately: gstSeparate,
    scopeItems: [...scopeItems],
    tenureYears,
    payoutMonths,
    minMonthlyPayout,
    maxAggregateSupport,
    clauses: LOI_CLAUSES.map((c) => ({
      key: c.key,
      heading: c.heading,
      body: renderTemplate(c.body, values),
    })),
    closing,
    signatory,
    createdAt: null,
    updatedAt: null,
  };
}

function salutationFor(lead: Lead): string {
  if (lead.client?.company?.trim()) return "M/s";
  return "Mr.";
}

function addressFor(lead: Lead): string {
  const c = lead.client;
  if (!c) return "";
  return [c.company, c.address, c.city, c.state].filter(Boolean).join(", ");
}

/** Sum of the schedule rows — what the letter's total line should show. */
export function scheduleTotal(rows: EoiScheduleRow[]): number {
  return rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
}

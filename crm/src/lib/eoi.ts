/**
 * Builds a Letter of Intent from a lead's quotation.
 *
 * The result is a *starting point*, not the final letter — every field is
 * editable before issue. That is deliberate: the letters Livanto actually
 * sends vary in tranche count and in what equipment is bundled. Hard-coding
 * one shape would mean re-typing the letter outside the CRM, which is
 * exactly the problem this is meant to solve.
 *
 * The payment schedule mirrors the quotation's own line items rather than a
 * separate proportional split: an Advance token, then an installment for
 * Electrical & Civil Work (the quote's 18%-rate lines), then an installment
 * for the Charger Equipment (the 5%-rate lines) — the same two-line GST
 * split shown everywhere else in the CRM, so the letter and the quotation
 * never disagree about what's taxed at what rate.
 */

import {
  COMPANY, DEFAULT_PAYOUT_MONTHS, DEFAULT_SCOPE_ITEMS, DEFAULT_TENURE_YEARS,
  LAND_TYPE_LABEL, LOCATION_PROVIDER_LABEL, SITE_COMPENSATION_TYPE_LABEL,
} from "./constants";
import {
  amountInWords, DEFAULT_CLOSING, defaultIntro, defaultSubject, LOI_CLAUSES,
  renderTemplate,
} from "./loi-template";
import { getSpec } from "./catalog";
import { buildQuote, describeCapacity, type QuoteLine } from "./pricing";
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
  // The site's own negotiated tenure (if set) beats the company-wide default —
  // it's the number that was actually agreed for this deal.
  const tenureYears = opts.tenureYears ?? lead.site?.tenureYears ?? opts.settings?.loi.tenureYears ?? DEFAULT_TENURE_YEARS;
  const payoutMonths = opts.payoutMonths ?? opts.settings?.loi.payoutMonths ?? DEFAULT_PAYOUT_MONTHS;
  const shortName = opts.settings?.company.shortName?.trim() || COMPANY.shortName;
  const scopeItems = opts.settings?.loi.scopeItems?.length ? opts.settings.loi.scopeItems : DEFAULT_SCOPE_ITEMS;
  const signatory = opts.settings?.loi.signatory?.trim() || COMPANY.signatory;
  const closing = opts.settings?.loi.closing?.trim() || DEFAULT_CLOSING;

  const siteName =
    [lead.site?.locationName?.trim(), lead.site?.address?.trim()].filter(Boolean).join(" — ") ||
    lead.linkedLeads?.[0]?.name?.trim() ||
    [lead.client?.city, lead.client?.state].filter(Boolean).join(", ") ||
    "the Investor's premises";

  const siteLocationProvider = lead.site?.locationProvider ? LOCATION_PROVIDER_LABEL[lead.site.locationProvider] : "";
  const siteMapsLink = lead.site?.mapsLink?.trim() ?? "";
  const siteLandType = lead.site?.landType ? LAND_TYPE_LABEL[lead.site.landType] : "";
  const siteCompensation =
    lead.site?.compensationType && lead.site.compensationAmount != null
      ? `${SITE_COMPENSATION_TYPE_LABEL[lead.site.compensationType]} — ${
        lead.site.compensationType === "REVENUE_SHARE"
          ? `${lead.site.compensationAmount}%`
          : formatINR(lead.site.compensationAmount)
      }`
      : lead.site?.compensationType
        ? SITE_COMPENSATION_TYPE_LABEL[lead.site.compensationType]
        : "";
  // Sanctioned beats requested — it's the confirmed number once the bank has approved it.
  const loanOpted = Boolean(lead.financing && lead.financing.mode !== "SELF");
  const amountFinanced = lead.financing?.sanctionedAmount ?? lead.financing?.requestedAmount ?? 0;
  const subsidyAmount = lead.financing?.subsidyEnabled ? lead.financing.subsidyAmount ?? 0 : 0;
  const subsidyPct = lead.financing?.subsidyEnabled ? lead.financing.subsidyPct ?? 0 : 0;
  // What's left for the investor to pay themselves once the bank's share (and any subsidy) is netted out.
  const clientPayment = loanOpted ? Math.max(0, quote.grandTotal - amountFinanced - subsidyAmount) : 0;

  // Per-unit earning assumptions — only meaningful once the site's own selling rate is set.
  const sellingRatePerKwh = lead.site?.sellingRatePerKwh ?? 0;
  const discomRatePerKwh = lead.site?.electricityRatePerKwh ?? 0;
  const siteOwnerSharePerKwh = lead.site?.siteOwnerSharePerKwh ?? 0;
  const livantoEarningPerKwh = lead.site?.livantoEarningPerKwh ?? 0;
  const franchiseEarningPerKwh = sellingRatePerKwh > 0
    ? Math.round((sellingRatePerKwh - siteOwnerSharePerKwh - livantoEarningPerKwh - discomRatePerKwh) * 100) / 100
    : 0;
  const b2bRatePerKwh = lead.site?.b2bRatePerKwh ?? 0;

  // Three stages, each GST-inclusive and matching what's actually taxed at
  // that rate — Advance (a fixed booking token), then Electrical & Civil
  // Work (the quote's 18%-rate lines), then Charger Equipment (the 5%-rate
  // lines). Scaled by the same keepRatio buildQuote() itself uses, so a
  // discount reduces every stage proportionally and the three always add
  // back up to the grand total.
  const keepRatio = quote.subtotal > 0 ? quote.taxableValue / quote.subtotal : 0;
  const scaledTotal = (l: QuoteLine) => Math.round(l.total * keepRatio);
  const isCivilLine = (l: QuoteLine) => (l.kind === "EXTRA" ? l.gstPct === 18 : l.key.endsWith("-civil"));

  const civilTotal = quote.lines.filter(isCivilLine).reduce((a, l) => a + scaledTotal(l), 0);
  const equipmentTotal = quote.lines.filter((l) => !isCivilLine(l)).reduce((a, l) => a + scaledTotal(l), 0);

  const advanceRaw = (lead.config ?? []).reduce((a, it) => a + (getSpec(it.sku)?.stage1EOI ?? 0) * it.qty, 0);
  const advance = Math.min(advanceRaw, civilTotal);

  const schedule: EoiScheduleRow[] = [];
  if (advance > 0) {
    schedule.push({ id: "s0", description: "Advance (EOI) — payable on execution of this LOI", amount: advance });
  }
  if (civilTotal - advance > 0) {
    schedule.push({
      id: "s1",
      description: "1st Installment — towards Electrical & Civil Work (inclusive of 18% GST)",
      amount: civilTotal - advance,
    });
  }
  if (equipmentTotal > 0) {
    schedule.push({
      id: "s2",
      description: "2nd Installment — towards Charger Equipment (inclusive of 5% GST)",
      amount: equipmentTotal,
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
    siteLocationProvider,
    siteMapsLink,
    siteCompensation,
    siteLandType,
    loanOpted,
    amountFinanced,
    clientPayment,
    subsidyAmount,
    subsidyPct,
    sellingRatePerKwh,
    discomRatePerKwh,
    siteOwnerSharePerKwh,
    livantoEarningPerKwh,
    franchiseEarningPerKwh,
    b2bRatePerKwh,
    capacityLabel,
    extraEquipment: opts.extraEquipment ?? "",
    subject: defaultSubject(capacityLabel, siteName, opts.extraEquipment),
    intro: defaultIntro(capacityLabel, opts.extraEquipment),
    schedule,
    totalAmount: quote.grandTotal,
    gstShownSeparately: false,
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

/**
 * Letter of Intent cum Expression of Interest.
 *
 * The clause text is transcribed from the LOIs Livanto already issues, with
 * the deal-specific values turned into placeholders. Everything here is a
 * starting point — every field is editable on the EOI screen before issue,
 * because the real letters vary (two tranches vs three, GST shown separately
 * vs included, complimentary AC charger, and so on).
 */

import { COMPANY } from "./constants";

export interface LoiClause {
  key: string;
  heading: string;
  /** Supports {{placeholder}} substitution. */
  body: string;
}

/**
 * Placeholders resolved when the letter is rendered:
 *   {{investorName}}   {{participationAmount}}  {{participationWords}}
 *   {{scheduleSentence}} {{tenureYears}}        {{payoutMonths}}
 *   {{minMonthlyPayout}} {{maxAggregate}}       {{siteName}}
 *   {{pronounSubject}}  {{kw}}                  {{company}}
 */
export const LOI_CLAUSES: LoiClause[] = [
  {
    key: "nature",
    heading: "Nature of this LOI",
    body:
      "This LOI records the Investor's expression of interest and commercial participation in the project described above. " +
      "It is a commercial infrastructure participation arrangement, and is not a partnership, joint venture, securities offering, " +
      "deposit, or collective investment scheme.",
  },
  {
    key: "amount",
    heading: "Total Participation Amount",
    body:
      "The Investor agrees to contribute {{participationAmount}} ({{participationWords}}) towards the project (“Participation Amount”). " +
      "GST shall be charged as per the prevailing rate at the time of each payment.",
  },
  {
    key: "schedule",
    heading: "Payment Schedule",
    body: "{{scheduleSentence}}",
  },
  {
    key: "tenure",
    heading: "Project Tenure",
    body:
      "The project shall run for a minimum of {{tenureYears}} years from the date of commercial commissioning, extendable by mutual " +
      "written consent, and shall be operated exclusively by {{company}} throughout.",
  },
  {
    key: "payout",
    heading: "Minimum Monthly Payout",
    body:
      "The Investor shall receive a minimum operational payout of {{minMonthlyPayout}} per month for {{payoutMonths}} months from " +
      "commercial commissioning. If in any month the station's net revenue falls short of this amount, {{company}} will support the " +
      "shortfall — provided the station is fully operational, the Investor is not in default, and the shortfall is not due to force " +
      "majeure, loss of site access, or DISCOM disconnection. {{company}}'s total exposure under this support is capped at " +
      "{{maxAggregate}} across the {{payoutMonths}} months. This is a limited revenue-support mechanism, not a guaranteed return or a " +
      "deposit, and surplus revenue above the minimum monthly payout will be shared as mutually agreed between the parties.",
  },
  {
    key: "site",
    heading: "Site",
    body:
      "The Charging Station shall be installed at the Investor's own premises at {{siteName}}. The project is subject to feasibility " +
      "and regulatory approval, including DISCOM load sanction. If the Site is found technically unviable at the feasibility stage, " +
      "the parties shall mutually agree an alternate location; this will not be treated as a breach of this LOI.",
  },
  {
    key: "confirmations",
    heading: "Investor Confirmations",
    body:
      "The Investor confirms that: participation follows independent evaluation of the commercial risks; the funds contributed are " +
      "self-owned, legitimately sourced, and their use does not violate any law; the Investor has full authority to enter this LOI; " +
      "all information and documents provided are true and complete; and the Investor understands charging-station revenues depend on " +
      "EV adoption, tariffs, traffic and demand, none of which {{company}} controls. The Investor also confirms this participation is " +
      "commercial in nature, that {{pronounSubject}} is not acting as a consumer under the Consumer Protection Act, 2019, and that " +
      "{{pronounSubject}} waives any cooling-off or cancellation right that might otherwise apply.",
  },
  {
    key: "forfeiture",
    heading: "Forfeiture and Refunds",
    body:
      "Failure to pay any installment within a reasonable time of the relevant milestone being reached shall entitle {{company}} to " +
      "terminate this LOI and retain any amount already paid up to that point. Any refund is at {{company}}'s sole discretion and net " +
      "of costs already incurred.",
  },
  {
    key: "confidentiality",
    heading: "Confidentiality and Intellectual Property",
    body:
      "The Investor shall keep {{company}}'s project model, financial structure and operational information confidential, both during " +
      "the term and for 2 years after. {{company}}'s trademarks, software and business know-how remain its exclusive property, and this " +
      "LOI does not license any of it to the Investor.",
  },
  {
    key: "indemnity",
    heading: "Indemnity and Liability",
    body:
      "The Investor shall indemnify {{company}} against losses arising from the Investor's breach, misrepresentation, or any " +
      "third-party claim relating to the site or the Investor's contribution. {{company}}'s total liability under this LOI (other than " +
      "under the Minimum Monthly Payout clause) is capped at the Participation Amount received, and excludes indirect or consequential " +
      "losses.",
  },
  {
    key: "termination",
    heading: "Termination",
    body:
      "{{company}} may terminate this LOI immediately on written notice if the Investor defaults on payment, breaches a material term " +
      "and fails to remedy it within 15 days of notice, or becomes insolvent. Provisions on forfeiture, confidentiality, indemnity and " +
      "liability shall survive any termination.",
  },
  {
    key: "forceMajeure",
    heading: "Force Majeure",
    body:
      "Neither party is liable for delays caused by events beyond its reasonable control, including natural disasters, government " +
      "restrictions, war, riots, pandemics or grid failures. {{company}}'s payout obligation is suspended for as long as such an event " +
      "continues, and either party may exit this LOI if it continues beyond 90 days.",
  },
  {
    key: "law",
    heading: "Governing Law and Disputes",
    body:
      `Disputes will be resolved by arbitration under the Arbitration and Conciliation Act, 1996, before a sole arbitrator appointed ` +
      `by {{company}}, seated at ${COMPANY.arbitrationSeat}. This LOI is governed by Indian law, subject to the exclusive ` +
      `jurisdiction of the courts at ${COMPANY.jurisdiction}.`,
  },
  {
    key: "general",
    heading: "General",
    body:
      "This LOI represents the entire understanding between the parties on this project. It may only be amended in writing signed by " +
      "both parties, and if any part of it is found unenforceable, the rest will remain in effect.",
  },
];

export const DEFAULT_CLOSING =
  "Kindly sign and return a copy of this Letter to enable us to proceed. On receipt of the Advance, we will commence site feasibility " +
  "and preparatory work, following which the Charging Station shall be handed over and made operational.";

export function defaultIntro(kwLabel: string, extraEquipment?: string): string {
  const extra = extraEquipment ? `, along with ${extraEquipment}` : "";
  return (
    `Thank you for your interest in ${COMPANY.legalName}'s EV charging infrastructure investment opportunities. We are pleased to ` +
    `share this Letter of Intent for your commercial participation, under our ${COMPANY.model} model, in the establishment and ` +
    `operation of a ${kwLabel} DC EV Charging Station${extra}, along with the payment structure, indicative monthly payout and the ` +
    `terms and conditions governing this participation, as detailed below.`
  );
}

export function defaultSubject(kwLabel: string, siteName: string, extraEquipment?: string): string {
  const extra = extraEquipment ? ` (with ${extraEquipment})` : "";
  const at = siteName ? ` at ${siteName}` : "";
  return (
    `Letter of Intent cum Expression of Interest for Commercial Participation in a ${kwLabel} DC EV Charging Station` +
    `${extra} under the FOCO Model${at}`
  );
}

/** Fills {{placeholders}}; anything unresolved is left visible rather than blanked. */
export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    values[key] !== undefined && values[key] !== "" ? values[key] : whole,
  );
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]!;
  const t = TENS[Math.floor(n / 10)]!;
  const o = ONES[n % 10]!;
  return o ? `${t} ${o}` : t;
}

/**
 * Indian-system amount in words — "Rupees Fifteen Lakh Fifty Thousand Only".
 * The LOI quotes the figure in words in the participation clause, so this has
 * to read the way an Indian contract reads, not the international grouping.
 */
export function amountInWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return "Rupees Zero Only";

  const crore = Math.floor(n / 1_00_00_000);
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((n % 1_00_000) / 1_000);
  const hundred = Math.floor((n % 1_000) / 100);
  const rest = n % 100;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(twoDigits(rest));

  return `Rupees ${parts.join(" ")} Only`;
}

/**
 * Deterministic lead score, 0-100 — Hot/Warm/Cold. Not machine-learned: a
 * transparent sum of signals the sales team already records, so a manager
 * can always explain why a lead scored the way it did.
 */

import { SCORE_BANDS } from "./constants";
import type { Lead } from "./types";
import { toDate } from "./utils";

export interface ScoreBreakdown {
  score: number;
  band: (typeof SCORE_BANDS)[number];
  factors: { label: string; points: number }[];
}

export function scoreLead(lead: Lead): ScoreBreakdown {
  const factors: { label: string; points: number }[] = [];

  // Financing readiness — a funded deal is much closer to closing.
  if (lead.financing?.mode === "SELF") {
    factors.push({ label: "Self-funded", points: 15 });
  } else if (lead.financing?.stage === "DISBURSED" || lead.financing?.stage === "SANCTIONED") {
    factors.push({ label: "Loan sanctioned/disbursed", points: 15 });
  } else if (lead.financing?.stage && lead.financing.stage !== "NOT_APPLICABLE" && lead.financing.stage !== "ENQUIRY") {
    factors.push({ label: "Loan in progress", points: 8 });
  }

  // Site readiness.
  if (lead.site?.locationName?.trim()) factors.push({ label: "Site identified", points: 10 });
  if (lead.site?.sanctionedLoadKva) factors.push({ label: "Power load known", points: 8 });
  if ((lead.site?.locationTypes ?? []).length > 0) factors.push({ label: "Site type known", points: 5 });

  // Commercial commitment.
  if ((lead.config ?? []).length > 0) factors.push({ label: "Charger configuration selected", points: 15 });
  if (lead.value > 0) factors.push({ label: "Quotation generated", points: 10 });
  if (lead.eoi) factors.push({ label: "Letter of Intent drafted", points: 15 });
  if (lead.eoi?.status === "ISSUED" || lead.eoi?.status === "ACCEPTED") {
    factors.push({ label: "Letter of Intent issued", points: 10 });
  }
  if ((lead.paidAmount ?? 0) > 0) factors.push({ label: "Payment received", points: 15 });

  // Decision-maker / documentation signals.
  if (lead.client?.pan?.trim()) factors.push({ label: "PAN on file", points: 5 });
  if (lead.client?.email?.trim()) factors.push({ label: "Email on file", points: 3 });

  // Timeline urgency.
  const close = toDate(lead.expectedCloseAt);
  if (close) {
    const days = (close.getTime() - Date.now()) / 86_400_000;
    if (days <= 30 && days >= -7) factors.push({ label: "Expected to close soon", points: 8 });
  }

  // Engagement penalty — a follow-up that slipped is a cooling signal.
  const followUp = toDate(lead.nextFollowUpAt);
  if (followUp && followUp.getTime() < Date.now() - 3 * 86_400_000) {
    factors.push({ label: "Follow-up overdue", points: -15 });
  }

  const rawScore = factors.reduce((a, f) => a + f.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));
  const band = SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1]!;

  return { score, band, factors };
}

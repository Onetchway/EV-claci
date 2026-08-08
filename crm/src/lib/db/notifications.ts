"use client";

/**
 * Email notifications.
 *
 * The CRM itself never talks to an SMTP server — instead it writes a document
 * to the `mail` collection, which is the exact schema the Firebase "Trigger
 * Email" extension watches: install that extension (Firebase Console →
 * Extensions → search "Trigger Email"), point it at any SMTP account (a
 * Gmail app password or a transactional sender like SendGrid/Resend both
 * work), and it sends whatever lands in this collection. Nothing else in the
 * app needs to change if the SMTP provider is swapped later.
 */

import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { getDb } from "../firebase/client";

export const MAIL = "mail";

export interface QueueEmailInput {
  to: string[];
  subject: string;
  html: string;
  /** Plain-text fallback; falls back to a stripped version of the HTML. */
  text?: string;
}

/** Fire-and-forget: a failed notification must never block the user's action. */
export function queueEmailSafe(input: QueueEmailInput): void {
  const to = [...new Set(input.to.filter(Boolean))];
  if (to.length === 0) return;
  void addDoc(collection(getDb(), MAIL), {
    to,
    message: {
      subject: input.subject,
      html: input.html,
      text: input.text ?? input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    },
    createdAt: serverTimestamp(),
  }).catch((err) => {
    console.error("[notifications] failed to queue email", err);
  });
}

const APP_URL = "https://app.livantogreen.com";

export function leadUrl(leadId: string): string {
  return `${APP_URL}/leads/${leadId}`;
}

function wrap(bodyHtml: string): string {
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.5;max-width:520px">` +
    `<p style="margin:0 0 12px;font-weight:700;font-size:16px">Livanto Green CRM</p>` +
    bodyHtml +
    `<p style="margin:20px 0 0;color:#888;font-size:12px">You're receiving this because you're part of the Livanto Green CRM team.</p>` +
    `</div>`
  );
}

export function notifyAssigned(opts: {
  toEmail: string;
  agentName: string;
  leadCode: string;
  leadName?: string;
  actorName: string;
  leadId: string;
}): void {
  queueEmailSafe({
    to: [opts.toEmail],
    subject: `Lead ${opts.leadCode} assigned to you`,
    html: wrap(
      `<p>Hi ${opts.agentName},</p>` +
      `<p><strong>${opts.actorName}</strong> assigned lead <strong>${opts.leadCode}</strong>` +
      `${opts.leadName ? ` (${opts.leadName})` : ""} to you.</p>` +
      `<p><a href="${leadUrl(opts.leadId)}" style="color:#0ea5e9">Open the lead →</a></p>`,
    ),
  });
}

export function notifyMention(opts: {
  toEmail: string;
  mentionedByName: string;
  leadCode: string;
  leadId: string;
  message: string;
}): void {
  queueEmailSafe({
    to: [opts.toEmail],
    subject: `${opts.mentionedByName} mentioned you on ${opts.leadCode}`,
    html: wrap(
      `<p><strong>${opts.mentionedByName}</strong> mentioned you on lead <strong>${opts.leadCode}</strong>:</p>` +
      `<p style="padding:10px 14px;background:#f8fafc;border-left:3px solid #0ea5e9;border-radius:4px">${opts.message}</p>` +
      `<p><a href="${leadUrl(opts.leadId)}" style="color:#0ea5e9">Open the lead →</a></p>`,
    ),
  });
}

export function notifyStageOrStatus(opts: {
  toEmail: string;
  agentName: string;
  leadCode: string;
  leadId: string;
  actorName: string;
  summary: string;
}): void {
  queueEmailSafe({
    to: [opts.toEmail],
    subject: `${opts.leadCode} updated: ${opts.summary}`,
    html: wrap(
      `<p>Hi ${opts.agentName},</p>` +
      `<p><strong>${opts.actorName}</strong> updated lead <strong>${opts.leadCode}</strong>: ${opts.summary}</p>` +
      `<p><a href="${leadUrl(opts.leadId)}" style="color:#0ea5e9">Open the lead →</a></p>`,
    ),
  });
}

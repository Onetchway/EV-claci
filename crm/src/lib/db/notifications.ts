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

import {
  addDoc, collection, doc, getDoc, limit as fsLimit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";

import type { Role } from "../constants";
import { ymd } from "../dates";
import { getDb } from "../firebase/client";
import type { AppNotification } from "../types";
import { getUsersByRole } from "./users";

export const MAIL = "mail";
export const NOTIFICATIONS = "notifications";

/** In-app notification bell — separate from the email queue above. */
export interface CreateNotificationInput {
  toUid: string;
  title: string;
  body: string;
  leadId?: string;
}

function createNotificationSafe(input: CreateNotificationInput): void {
  void addDoc(collection(getDb(), NOTIFICATIONS), {
    uid: input.toUid,
    title: input.title,
    body: input.body,
    leadId: input.leadId ?? null,
    read: false,
    createdAt: serverTimestamp(),
  }).catch((err) => {
    console.error("[notifications] failed to create in-app notification", err);
  });
}

export function subscribeMyNotifications(
  uid: string,
  cb: (rows: AppNotification[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(getDb(), NOTIFICATIONS), where("uid", "==", uid), orderBy("createdAt", "desc"), fsLimit(30)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppNotification, "id">) }))),
    (err) => onError?.(err as Error),
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(getDb(), NOTIFICATIONS, id), { read: true });
}

/** Notifies everyone holding any of the given roles — used when something new needs a role-gated review (a payment needing Finance/Admin sign-off, a document needing Operations/Finance/Admin review), rather than one specific assignee. */
export function notifyVerifiersSafe(opts: {
  roles: Role[];
  title: string;
  body: string;
  leadId?: string;
}): void {
  void (async () => {
    const verifiers = await getUsersByRole(opts.roles);
    for (const u of verifiers) {
      createNotificationSafe({ toUid: u.uid, title: opts.title, body: opts.body, leadId: opts.leadId });
    }
  })().catch((err) => {
    console.error("[notifications] failed to notify verifiers", err);
  });
}

export async function markAllNotificationsRead(rows: AppNotification[]): Promise<void> {
  const unread = rows.filter((r) => !r.read);
  if (unread.length === 0) return;
  const batch = writeBatch(getDb());
  for (const r of unread) batch.update(doc(getDb(), NOTIFICATIONS, r.id), { read: true });
  await batch.commit();
}

/**
 * A lead's follow-up date arriving used to be visible only as a dashboard
 * count, easy to lose track of — this puts it in the owner's own
 * notification bell instead. Keyed by `${leadId}_${today}` so it's a no-op
 * if it already ran today (e.g. the app was open all day), but a fresh,
 * unread reminder appears each new day the follow-up stays overdue and the
 * lead untouched — reading yesterday's copy doesn't silence today's. It
 * naturally stops once the agent actually works the lead: moving the
 * follow-up date forward, or changing its stage/status off ACTIVE, both
 * drop it out of the "due" query this is called from (see
 * components/followup-reminders.tsx).
 */
export function notifyFollowUpDueSafe(lead: { id: string; code: string; clientName?: string; ownerId: string }): void {
  void (async () => {
    const ref = doc(getDb(), NOTIFICATIONS, `followup_${lead.id}_${ymd(new Date())}`);
    const existing = await getDoc(ref);
    if (existing.exists()) return;
    await setDoc(ref, {
      uid: lead.ownerId,
      title: "Follow-up due",
      body: `${lead.clientName ?? "This lead"} (${lead.code}) has a follow-up due — open it to reschedule or log what happened.`,
      leadId: lead.id,
      read: false,
      createdAt: serverTimestamp(),
    });
  })().catch((err) => {
    console.error("[notifications] failed to create follow-up reminder", err);
  });
}

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
  toUid: string;
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
  createNotificationSafe({
    toUid: opts.toUid,
    title: `Lead ${opts.leadCode} assigned to you`,
    body: `${opts.actorName} assigned ${opts.leadName ?? "a lead"} to you.`,
    leadId: opts.leadId,
  });
}

export function notifyMention(opts: {
  toUid: string;
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
  createNotificationSafe({
    toUid: opts.toUid,
    title: `${opts.mentionedByName} mentioned you on ${opts.leadCode}`,
    body: opts.message,
    leadId: opts.leadId,
  });
}

export function notifyComplaintTag(opts: {
  toUid: string;
  toEmail: string;
  taggedByName: string;
  subject: string;
}): void {
  queueEmailSafe({
    to: [opts.toEmail],
    subject: `${opts.taggedByName} tagged you on a complaint: ${opts.subject}`,
    html: wrap(
      `<p><strong>${opts.taggedByName}</strong> tagged you on a complaint:</p>` +
      `<p style="padding:10px 14px;background:#f8fafc;border-left:3px solid #0ea5e9;border-radius:4px">${opts.subject}</p>` +
      `<p><a href="${APP_URL}/complaints" style="color:#0ea5e9">Open Complaints →</a></p>`,
    ),
  });
  createNotificationSafe({
    toUid: opts.toUid,
    title: `${opts.taggedByName} tagged you on a complaint`,
    body: opts.subject,
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

/** Customer-facing wrapper (invoices, receipts, wallet alerts) — separate branding from the internal-staff wrap() above; company name is caller-supplied so white-label Organizations can send under their own name. */
function wrapCustomer(bodyHtml: string, companyName = "Livanto Green"): string {
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;line-height:1.6;max-width:520px">` +
    `<p style="margin:0 0 16px;font-weight:700;font-size:18px;color:#0f766e">${companyName}</p>` +
    bodyHtml +
    `<p style="margin:24px 0 0;color:#888;font-size:12px">This is an automated message from ${companyName}. Please don't reply directly to this email.</p>` +
    `</div>`
  );
}

export function emailInvoiceIssued(opts: {
  to: string;
  invoiceNumber: string;
  totalInr: number;
  invoiceUrl: string;
  companyName?: string;
}): void {
  queueEmailSafe({
    to: [opts.to],
    subject: `Invoice ${opts.invoiceNumber} from ${opts.companyName ?? "Livanto Green"}`,
    html: wrapCustomer(
      `<p>Hello,</p>` +
      `<p>Your invoice <strong>${opts.invoiceNumber}</strong> for <strong>₹${opts.totalInr.toLocaleString("en-IN")}</strong> is ready.</p>` +
      `<p><a href="${opts.invoiceUrl}" style="color:#0f766e">View invoice →</a></p>`,
      opts.companyName,
    ),
  });
}

export function emailPaymentReceipt(opts: {
  to: string;
  amountInr: number;
  newBalanceInr: number;
  razorpayPaymentId?: string;
  companyName?: string;
}): void {
  queueEmailSafe({
    to: [opts.to],
    subject: `Payment received — ₹${opts.amountInr.toLocaleString("en-IN")}`,
    html: wrapCustomer(
      `<p>Hello,</p>` +
      `<p>We've received your top-up of <strong>₹${opts.amountInr.toLocaleString("en-IN")}</strong>.</p>` +
      `<p>New wallet balance: <strong>₹${opts.newBalanceInr.toLocaleString("en-IN")}</strong></p>` +
      (opts.razorpayPaymentId ? `<p style="color:#888;font-size:12px">Payment reference: ${opts.razorpayPaymentId}</p>` : ""),
      opts.companyName,
    ),
  });
}

export function emailLowWalletBalance(opts: {
  to: string;
  balanceInr: number;
  thresholdInr: number;
  topUpUrl?: string;
  companyName?: string;
}): void {
  queueEmailSafe({
    to: [opts.to],
    subject: `Low wallet balance — ₹${opts.balanceInr.toLocaleString("en-IN")}`,
    html: wrapCustomer(
      `<p>Hello,</p>` +
      `<p>Your wallet balance is now <strong>₹${opts.balanceInr.toLocaleString("en-IN")}</strong>, below the ₹${opts.thresholdInr.toLocaleString("en-IN")} alert threshold.</p>` +
      `<p>Top up soon to avoid a declined session at the charger.</p>` +
      (opts.topUpUrl ? `<p><a href="${opts.topUpUrl}" style="color:#0f766e">Top up now →</a></p>` : ""),
      opts.companyName,
    ),
  });
}

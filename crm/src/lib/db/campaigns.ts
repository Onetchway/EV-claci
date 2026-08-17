"use client";

/**
 * Marketing campaigns — email/notification blasts and banners. Sending is
 * a direct client-side fan-out (queueEmailSafe per targeted user), not a
 * background job: there's no server-side worker infra in this app beyond
 * ocpp-server's own charging-domain sweeps, so "Send now" really does send
 * from the admin's own browser session while the page is open. Fine at the
 * user-base sizes this platform runs at today; would need a real queue
 * (Cloud Function/Task) before that stops being true.
 */

import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc,
} from "firebase/firestore";

import { getDb } from "../firebase/client";
import { queueEmailSafe } from "./notifications";
import { CORPORATE_ACCOUNTS, EMSP_USERS } from "./emsp-users";
import type { Actor, Campaign, CampaignAudience, CorporateAccount, EmspUser } from "../types";

export const CAMPAIGNS = "campaigns";

function mapCampaign(id: string, data: Record<string, unknown>): Campaign {
  return { id, ...(data as Omit<Campaign, "id">) };
}

export function subscribeCampaigns(cb: (rows: Campaign[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(
    query(collection(getDb(), CAMPAIGNS), orderBy("createdAt", "desc")),
    (snap) => cb(snap.docs.map((d) => mapCampaign(d.id, d.data()))),
    (err) => onError?.(err as Error),
  );
}

export type CampaignDraft = Pick<Campaign, "name" | "audience" | "subject" | "message" | "showAsBanner" | "bannerImageUrl" | "bannerLinkUrl"> & {
  startAt?: Date | null;
  endAt?: Date | null;
};

function draftToDoc(draft: CampaignDraft) {
  return {
    ...draft,
    startAt: draft.startAt ? Timestamp.fromDate(draft.startAt) : null,
    endAt: draft.endAt ? Timestamp.fromDate(draft.endAt) : null,
  };
}

export async function createCampaign(draft: CampaignDraft, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(getDb(), CAMPAIGNS), {
    ...draftToDoc(draft), active: true, createdAt: serverTimestamp(), createdBy: actor,
  });
  return ref.id;
}

export async function updateCampaign(id: string, draft: CampaignDraft): Promise<void> {
  await updateDoc(doc(getDb(), CAMPAIGNS, id), draftToDoc(draft));
}

export async function setCampaignActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(getDb(), CAMPAIGNS, id), { active });
}

export async function deleteCampaign(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), CAMPAIGNS, id));
}

/** Fans out to every targeted recipient's email via the same mail-collection queue the rest of the app uses. Recipients with no email on file are silently skipped — there's no other channel to reach them on. */
export async function sendCampaignNow(campaign: Campaign): Promise<number> {
  const emails = await collectAudienceEmails(campaign.audience);
  if (emails.length === 0) return 0;

  const html = `<p>${campaign.message.replace(/\n/g, "<br/>")}</p>`;
  // Batches of 50 — queueEmailSafe's `to` array is one mail doc per call, and a single doc with hundreds of recipients in `to` would put every recipient's address in every other recipient's inbox headers.
  for (let i = 0; i < emails.length; i += 50) {
    queueEmailSafe({ to: emails.slice(i, i + 50), subject: campaign.subject, html });
  }

  await updateDoc(doc(getDb(), CAMPAIGNS, campaign.id), { sentAt: serverTimestamp(), sentCount: emails.length });
  return emails.length;
}

async function collectAudienceEmails(audience: CampaignAudience): Promise<string[]> {
  const emails = new Set<string>();
  if (audience === "ALL_EMSP" || audience === "ALL") {
    const snap = await getDocs(collection(getDb(), EMSP_USERS));
    for (const d of snap.docs) {
      const email = (d.data() as EmspUser).email;
      if (email) emails.add(email);
    }
  }
  if (audience === "ALL_CORPORATE" || audience === "ALL") {
    const snap = await getDocs(collection(getDb(), CORPORATE_ACCOUNTS));
    for (const d of snap.docs) {
      const email = (d.data() as CorporateAccount).billingEmail;
      if (email) emails.add(email);
    }
  }
  return [...emails];
}

/**
 * Firebase Admin init — same two auth paths as the CRM's own admin scripts
 * (scripts/seed.ts): a service-account key via env var, or Application
 * Default Credentials (what Cloud Run's own service identity provides
 * automatically once deployed — no key to manage there).
 */

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(json);
  return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key };
}

export function initFirebase(): void {
  if (getApps().length) return;
  const sa = serviceAccount();
  if (sa) {
    initializeApp({ credential: cert(sa), projectId: sa.projectId });
    console.log(`[firebase] authenticated with a service-account key (project ${sa.projectId}).`);
    return;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) {
    throw new Error(
      "No Firebase project configured. Set FIREBASE_PROJECT_ID, or run on Cloud Run " +
        "where GOOGLE_CLOUD_PROJECT is set automatically.",
    );
  }
  initializeApp({ credential: applicationDefault(), projectId });
  console.log(`[firebase] authenticated via Application Default Credentials (project ${projectId}).`);
}

export const db = () => getFirestore();

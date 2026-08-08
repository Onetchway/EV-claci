import "server-only";

import {
  applicationDefault, cert, getApp, getApps, initializeApp, type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Admin SDK, used only by route handlers that must bypass security rules:
 * creating users, minting role custom-claims, and deleting/disabling accounts.
 *
 * Credentials are resolved in two ways:
 *
 *  1. An explicit service-account key in the environment — how local
 *     development and non-Google hosts authenticate.
 *  2. Application Default Credentials — what runs in production on Firebase
 *     App Hosting / Cloud Run, where a service account is already attached to
 *     the instance. This is strictly better than shipping a private key: there
 *     is no long-lived secret to leak or rotate.
 */

const APP_NAME = "livanto-crm-admin";

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    // Accept either raw JSON or a base64 blob (easier to paste into a host's env UI).
    const json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(json) as { project_id: string; client_email: string; private_key: string };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    };
  }
  return null;
}

/**
 * True when running somewhere Google injects credentials automatically —
 * App Hosting, Cloud Run, Cloud Functions, or a shell with
 * GOOGLE_APPLICATION_CREDENTIALS set.
 */
function hasApplicationDefault(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_CONFIG ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.K_SERVICE, // set by Cloud Run, which App Hosting builds on
  );
}

export function adminConfigured(): boolean {
  return serviceAccount() !== null || hasApplicationDefault();
}

export function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;

  const sa = serviceAccount();
  if (sa) {
    return initializeApp(
      {
        credential: cert({
          projectId: sa.project_id,
          clientEmail: sa.client_email,
          privateKey: sa.private_key,
        }),
      },
      APP_NAME,
    );
  }

  if (hasApplicationDefault()) {
    return initializeApp(
      {
        credential: applicationDefault(),
        projectId:
          process.env.GOOGLE_CLOUD_PROJECT ??
          process.env.GCLOUD_PROJECT ??
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      },
      APP_NAME,
    );
  }

  throw new Error(
    "Firebase Admin credentials missing. In production on App Hosting this is " +
      "provided automatically; locally, set FIREBASE_SERVICE_ACCOUNT_KEY (JSON or base64) " +
      "or FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in .env.local.",
  );
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export { getApp };

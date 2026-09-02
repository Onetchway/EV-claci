"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;

function ensureApp(): FirebaseApp {
  if (!firebaseConfigured) {
    throw new Error(
      "Firebase is not configured. Copy .env.example to .env.local and fill in the NEXT_PUBLIC_FIREBASE_* values.",
    );
  }
  if (!app) app = getApps().length ? getApp() : initializeApp(config as Record<string, string>);
  return app;
}

// Local dev against the Firebase emulator suite (see scripts/dev-setup-crm.sh)
// instead of a real Firebase project. The Admin SDK auto-detects its own
// *_EMULATOR_HOST env vars server-side, but the browser-side SDK used here
// has no such auto-detection — without this, the browser silently tries to
// reach real Firebase servers with the emulator's fake API key and fails
// with "auth/api-key-not-valid". NEXT_PUBLIC_-prefixed so it's readable in
// the browser bundle; unset in every real deployment.
const AUTH_EMULATOR_HOST = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
const FIRESTORE_EMULATOR_HOST = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(ensureApp());
    if (AUTH_EMULATOR_HOST) {
      connectAuthEmulator(authInstance, `http://${AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    }
  }
  return authInstance;
}

export function getDb(): Firestore {
  // ignoreUndefinedProperties: an optional form field left blank naturally
  // becomes `undefined` in a draft object (e.g. maxSocPercent) — Firestore's
  // default addDoc/updateDoc rejects that outright ("Unsupported field
  // value: undefined") rather than just omitting the field. This setting
  // makes it behave the sane way everywhere, instead of requiring every
  // call site to manually strip undefined keys before writing.
  if (!dbInstance) {
    dbInstance = initializeFirestore(ensureApp(), { ignoreUndefinedProperties: true });
    if (FIRESTORE_EMULATOR_HOST) {
      const [host, port] = FIRESTORE_EMULATOR_HOST.split(":");
      connectFirestoreEmulator(dbInstance, host, Number(port));
    }
  }
  return dbInstance;
}

export function getBucket(): FirebaseStorage {
  if (!storageInstance) storageInstance = getStorage(ensureApp());
  return storageInstance;
}

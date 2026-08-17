/**
 * Admin-configurable automation parameters — previously hardcoded
 * constants/env vars in tickets.ts and wallet.ts. Backed by a single
 * settings/autoTriggers doc the CRM's /auto-triggers page writes to.
 * Cached in-memory with a short TTL so every session/ticket check doesn't
 * cost a Firestore read; falls back to the original env-var/hardcoded
 * defaults if the doc doesn't exist yet, so nothing breaks pre-migration.
 */

import { db } from "./firebase.js";

export interface AutoTriggerSettings {
  faultSlaHoursDefault: number;
  offlineSweepMinutes: number;
  autoRecoveryEnabled: boolean;
  autoRecoveryCooldownMinutes: number;
  lowBalanceAlertEnabled: boolean;
  lowBalanceThresholdInr: number;
}

function defaults(): AutoTriggerSettings {
  return {
    faultSlaHoursDefault: Number(process.env.FAULT_SLA_HOURS) || 4,
    offlineSweepMinutes: (Number(process.env.OFFLINE_SWEEP_MS) || 6 * 60 * 1000) / 60_000,
    autoRecoveryEnabled: true,
    autoRecoveryCooldownMinutes: 30,
    lowBalanceAlertEnabled: true,
    lowBalanceThresholdInr: Number(process.env.LOW_BALANCE_THRESHOLD_INR) || 100,
  };
}

const CACHE_TTL_MS = 60_000;
let cached: AutoTriggerSettings | null = null;
let cachedAt = 0;

export async function getAutoTriggerSettings(): Promise<AutoTriggerSettings> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const snap = await db().collection("settings").doc("autoTriggers").get();
    cached = { ...defaults(), ...(snap.exists ? (snap.data() as Partial<AutoTriggerSettings>) : {}) };
  } catch {
    cached = defaults();
  }
  cachedAt = Date.now();
  return cached;
}

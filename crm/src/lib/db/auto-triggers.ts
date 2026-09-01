"use client";

/**
 * Admin-editable automation parameters the OCPP server reads (see
 * ocpp-server/src/auto-triggers.ts) — fault SLA hours, auto-recovery
 * cooldown, low-wallet-balance alert threshold. A single settings doc,
 * cached briefly server-side so this doesn't cost a Firestore read per
 * ticket/session.
 */

import { doc, onSnapshot, setDoc } from "firebase/firestore";

import { getDb } from "../firebase/client";

export interface AutoTriggerSettings {
  faultSlaHoursDefault: number;
  offlineSweepMinutes: number;
  autoRecoveryEnabled: boolean;
  autoRecoveryCooldownMinutes: number;
  lowBalanceAlertEnabled: boolean;
  lowBalanceThresholdInr: number;
}

export const DEFAULT_AUTO_TRIGGER_SETTINGS: AutoTriggerSettings = {
  faultSlaHoursDefault: 4,
  offlineSweepMinutes: 6,
  autoRecoveryEnabled: true,
  autoRecoveryCooldownMinutes: 30,
  lowBalanceAlertEnabled: true,
  lowBalanceThresholdInr: 100,
};

export function subscribeAutoTriggerSettings(
  cb: (settings: AutoTriggerSettings) => void,
  onError?: (e: Error) => void,
): () => void {
  return onSnapshot(
    doc(getDb(), "settings", "autoTriggers"),
    (snap) => cb({ ...DEFAULT_AUTO_TRIGGER_SETTINGS, ...(snap.exists() ? (snap.data() as Partial<AutoTriggerSettings>) : {}) }),
    (err) => onError?.(err as Error),
  );
}

export async function updateAutoTriggerSettings(settings: AutoTriggerSettings): Promise<void> {
  await setDoc(doc(getDb(), "settings", "autoTriggers"), settings, { merge: true });
}
